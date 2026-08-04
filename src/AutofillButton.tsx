import { useState } from "react";
import { addAnswer } from "./storage/profileStorage";
import { SUPPORTED_ATS_LABELS, isSupportedHost } from "./ats/fieldMapRegistry";
import type {
  AutofillRequest,
  AutofillResponse,
  StopRequest,
  StopResponse,
  UndoRequest,
  UndoResponse,
} from "./messages";

type Pending = { question: string; answer: string };

type Status =
  | { kind: "idle" }
  | {
      kind: "ok";
      filled: string[];
      skipped: string[];
      offPage: string[];
      currentStep?: string;
      stopped?: boolean;
    }
  | { kind: "info"; message: string }
  | { kind: "error"; message: string };

/*
 * Derived from the adapter registry rather than a hand-kept list, so the button
 * can never claim a host is supported when no field map backs it.
 */
function isSupportedUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return isSupportedHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function AutofillButton() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  async function onClick() {
    setBusy(true);
    setStopping(false);
    setStatus({ kind: "idle" });
    setCanUndo(false);
    setPending([]);
    setCaptureError(null);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) {
        setStatus({ kind: "error", message: "No active tab." });
        return;
      }
      if (!isSupportedUrl(tab.url)) {
        setStatus({
          kind: "error",
          message: `Active tab isn't a supported ATS (${SUPPORTED_ATS_LABELS.join(
            " / ",
          )}).`,
        });
        return;
      }
      const req: AutofillRequest = { type: "autofill" };
      let resp: AutofillResponse;
      try {
        resp = (await chrome.tabs.sendMessage(tab.id, req)) as AutofillResponse;
      } catch {
        setStatus({
          kind: "error",
          message:
            "Couldn't reach the page. Refresh the tab and try again.",
        });
        return;
      }
      if (!resp?.ok) {
        setStatus({
          kind: "error",
          message: resp?.error ?? "Autofill failed.",
        });
        return;
      }
      setStatus({
        kind: "ok",
        filled: resp.fields,
        skipped: resp.skipped,
        offPage: resp.offPage ?? [],
        currentStep: resp.currentStep,
        stopped: resp.stopped,
      });
      if (resp.filled > 0) setCanUndo(true);
      if (resp.unmatchedQuestions && resp.unmatchedQuestions.length > 0) {
        setPending(
          resp.unmatchedQuestions.map((q) => ({ question: q, answer: "" })),
        );
      }
    } finally {
      setBusy(false);
      setStopping(false);
    }
  }

  /**
   * Asks the content script to abort. Fields already written stay written —
   * Undo is the way to revert those — so this is a "stop doing more", not a
   * rollback.
   */
  async function onStop() {
    setStopping(true);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return;
      const req: StopRequest = { type: "stop" };
      (await chrome.tabs.sendMessage(tab.id, req)) as StopResponse;
    } catch {
      /* Run probably already finished; the finally block clears the state. */
    }
  }

  function updatePendingAnswer(idx: number, value: string) {
    setPending((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, answer: value } : p)),
    );
  }

  function skipPending(idx: number) {
    setPending((prev) => prev.filter((_, i) => i !== idx));
    setCaptureError(null);
  }

  async function savePending(idx: number) {
    const item = pending[idx];
    if (!item || !item.answer.trim()) return;
    setCaptureError(null);
    try {
      await addAnswer({
        id: crypto.randomUUID(),
        question: item.question,
        answer: item.answer.trim(),
        createdAt: Date.now(),
      });
      skipPending(idx);
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onUndo() {
    setBusy(true);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return;
      const req: UndoRequest = { type: "undo" };
      let resp: UndoResponse;
      try {
        resp = (await chrome.tabs.sendMessage(tab.id, req)) as UndoResponse;
      } catch {
        setStatus({
          kind: "error",
          message: "Couldn't reach the page to undo.",
        });
        return;
      }
      if (resp?.undone > 0) {
        setStatus({
          kind: "info",
          message: `Undone ${resp.undone} field${
            resp.undone > 1 ? "s" : ""
          }.`,
        });
      } else {
        setStatus({ kind: "info", message: "Nothing to undo." });
      }
      setCanUndo(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="autofill">
      <button
        className="autofill__btn"
        onClick={onClick}
        disabled={busy}
      >
        {busy ? "Filling…" : "Autofill this page"}
      </button>
      {busy && (
        <button
          type="button"
          className="autofill__stop"
          onClick={() => void onStop()}
          disabled={stopping}
        >
          {stopping ? "Stopping…" : "Stop filling"}
        </button>
      )}
      {canUndo && (
        <button
          type="button"
          className="autofill__undo"
          onClick={onUndo}
          disabled={busy}
        >
          Undo last fill
        </button>
      )}
      {status.kind === "info" && (
        <p className="autofill__feedback autofill__feedback--ok">
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p className="autofill__feedback autofill__feedback--err">
          {status.message}
        </p>
      )}
      {status.kind === "ok" && (
        <div className="autofill__result">
          <div className="autofill__result-head">
            {status.stopped && (
              <span className="autofill__result-stopped">Stopped early · </span>
            )}
            {status.filled.length > 0 ? (
              <span className="autofill__result-count">
                Filled{" "}
                <strong>{status.filled.length}</strong>{" "}
                field{status.filled.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="autofill__result-count autofill__result-count--zero">
                No fields filled
              </span>
            )}
            {status.skipped.length > 0 && (
              <span className="autofill__result-skipped">
                · {status.skipped.length} skipped
              </span>
            )}
          </div>
          {status.currentStep && (
            <p className="autofill__step">
              Step detected: <strong>{status.currentStep}</strong>
              {status.offPage.length > 0 && (
                <>
                  {" "}
                  · {status.offPage.length} field
                  {status.offPage.length === 1 ? "" : "s"} belong to later steps
                </>
              )}
            </p>
          )}
          {status.filled.length > 0 && (
            <ul className="autofill__list">
              {status.filled.map((f) => (
                <li
                  key={f}
                  className="autofill__list-item autofill__list-item--ok"
                >
                  <span className="autofill__list-dot" aria-hidden="true" />
                  <span className="autofill__list-text">{f}</span>
                </li>
              ))}
            </ul>
          )}
          {status.skipped.length > 0 && (
            <details className="autofill__skipped">
              <summary className="autofill__skipped-summary">
                Show skipped ({status.skipped.length})
              </summary>
              <ul className="autofill__list">
                {status.skipped.map((s, i) => (
                  <li
                    key={i}
                    className="autofill__list-item autofill__list-item--off"
                  >
                    <span className="autofill__list-dot" aria-hidden="true" />
                    <span className="autofill__list-text">{s}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {status.offPage.length > 0 && (
            <details className="autofill__skipped">
              <summary className="autofill__skipped-summary">
                On other steps ({status.offPage.length})
              </summary>
              <ul className="autofill__list">
                {status.offPage.map((s, i) => (
                  <li
                    key={i}
                    className="autofill__list-item autofill__list-item--off"
                  >
                    <span className="autofill__list-dot" aria-hidden="true" />
                    <span className="autofill__list-text">{s}</span>
                  </li>
                ))}
              </ul>
              <p className="autofill__hint">
                Workday splits one application across several steps. Click
                Autofill again on each step.
              </p>
            </details>
          )}
        </div>
      )}
      {pending.length > 0 && (
        <div className="autofill__capture">
          <div className="autofill__capture-head">
            <strong>{pending.length} new question{pending.length === 1 ? "" : "s"}</strong>{" "}
            on this page — save your answers to reuse them.
          </div>
          {pending.map((p, i) => (
            <div key={i} className="autofill__capture-card">
              <div className="autofill__capture-q">{p.question}</div>
              <textarea
                className="autofill__capture-input"
                rows={3}
                value={p.answer}
                onChange={(e) => updatePendingAnswer(i, e.target.value)}
                placeholder="Your answer…"
              />
              <div className="autofill__capture-actions">
                <button
                  type="button"
                  className="autofill__capture-skip"
                  onClick={() => skipPending(i)}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="autofill__capture-save"
                  onClick={() => void savePending(i)}
                  disabled={!p.answer.trim()}
                >
                  Save
                </button>
              </div>
            </div>
          ))}
          {captureError && (
            <p className="autofill__feedback autofill__feedback--err">
              {captureError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
