import { useState } from "react";
import type {
  AutofillRequest,
  AutofillResponse,
  UndoRequest,
  UndoResponse,
} from "./messages";

type Status =
  | { kind: "idle" }
  | { kind: "ok"; message: string }
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
      const filledLine =
        resp.filled > 0
          ? `Filled ${resp.filled}: ${resp.fields.join(", ")}`
          : "Filled 0 fields.";
      const skippedLine =
        resp.skipped.length > 0
          ? ` · skipped: ${resp.skipped.join("; ")}`
          : "";
      setStatus({ kind: "ok", message: filledLine + skippedLine });
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
          kind: "ok",
          message: `Undone ${resp.undone} field${resp.undone > 1 ? "s" : ""}.`,
        });
      } else {
        setStatus({ kind: "ok", message: "Nothing to undo." });
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
      {status.kind !== "idle" && (
        <p
          className={`autofill__feedback autofill__feedback--${
            status.kind === "ok" ? "ok" : "err"
          }`}
        >
          {status.message}
        </p>
      )}
    </section>
  );
}
