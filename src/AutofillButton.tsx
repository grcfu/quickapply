import { useState } from "react";
import type {
  AutofillRequest,
  AutofillResponse,
  UndoRequest,
  UndoResponse,
} from "./messages";

type Status =
  | { kind: "idle" }
  | { kind: "ok"; filled: string[]; skipped: string[] }
  | { kind: "info"; message: string }
  | { kind: "error"; message: string };

const ATS_HOSTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "myworkdayjobs.com",
];

function isSupportedUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return ATS_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function AutofillButton() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  async function onClick() {
    setBusy(true);
    setStatus({ kind: "idle" });
    setCanUndo(false);
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
          message:
            "Active tab isn't a supported ATS (Greenhouse / Lever / Ashby / Workday).",
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
      });
      if (resp.filled > 0) setCanUndo(true);
    } finally {
      setBusy(false);
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
        </div>
      )}
    </section>
  );
}
