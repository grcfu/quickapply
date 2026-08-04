import { requestStop, runAutofill, undoLastFill } from "./ats/runAutofill";
import { dumpForm } from "./ats/dumpForm";
import { isSupportedHost } from "./ats/fieldMapRegistry";
import type {
  AutofillResponse,
  DumpFormResponse,
  ExtensionMessage,
  StopResponse,
  UndoResponse,
} from "./messages";

/*
 * The manifest injects this into all frames, because a company careers page can
 * embed the real Workday application in an iframe — without `all_frames` that
 * subframe never gets a content script.
 *
 * The catch: chrome.tabs.sendMessage delivers to every frame and the FIRST
 * sendResponse wins. An outer frame with no adapter would otherwise race the
 * Workday iframe and reply "no adapter for host" before the fillable frame got
 * to answer. So frames we can't fill stay silent and let the real one respond.
 */
const canFill = isSupportedHost(window.location.hostname);

if (canFill) {
  console.log(
    "[QuickApply] content script active on",
    window.location.hostname,
  );

  chrome.runtime.onMessage.addListener(
    (msg: ExtensionMessage, _sender, sendResponse) => {
      if (msg?.type === "autofill") {
        runAutofill().then(
          (response: AutofillResponse) => sendResponse(response),
          (err: unknown) => {
            /*
             * Include the throw site. A bare "Illegal invocation" is
             * unactionable — the frame that raised it is the whole diagnosis.
             */
            const message = err instanceof Error ? err.message : String(err);
            const frame =
              err instanceof Error && err.stack
                ? err.stack.split("\n").slice(1, 3).join(" | ").trim()
                : "";
            console.error("[QuickApply] autofill failed:", err);
            sendResponse({
              ok: false,
              filled: 0,
              fields: [],
              skipped: [],
              error: frame ? `${message} — at ${frame}` : message,
            } satisfies AutofillResponse);
          },
        );
        return true;
      }
      if (msg?.type === "stop") {
        /* Synchronous: the in-flight run polls this flag between steps. */
        sendResponse({ ok: requestStop() } satisfies StopResponse);
        return false;
      }
      if (msg?.type === "dumpForm") {
        sendResponse({ ok: true, dump: dumpForm() } satisfies DumpFormResponse);
        return false;
      }
      if (msg?.type === "undo") {
        const result = undoLastFill();
        sendResponse({
          ok: true,
          undone: result.undone,
        } satisfies UndoResponse);
        return false;
      }
      return false;
    },
  );
}
