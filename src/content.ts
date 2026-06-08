import { runAutofill, undoLastFill } from "./ats/runAutofill";
import type {
  AutofillResponse,
  ExtensionMessage,
  UndoResponse,
} from "./messages";

console.log("[QuickApply] content script loaded");

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
      sendResponse({ ok: true, undone: result.undone } satisfies UndoResponse);
      return false;
    }
    return false;
  },
);
