import { runAutofill, undoLastFill } from "./ats/runAutofill";
import { isSupportedHost } from "./ats/fieldMapRegistry";
import type {
  AutofillResponse,
  ExtensionMessage,
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
          (err: unknown) =>
            sendResponse({
              ok: false,
              filled: 0,
              fields: [],
              skipped: [],
              error: err instanceof Error ? err.message : String(err),
            } satisfies AutofillResponse),
        );
        return true;
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
