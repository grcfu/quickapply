export type AutofillRequest = {
  type: "autofill";
};

export type AutofillResponse = {
  ok: boolean;
  filled: number;
  fields: string[];
  skipped: string[];
  /**
   * Fields absent from the DOM that belong to another step of a multi-page
   * apply flow. Expected, not failures — kept out of `skipped` so real problems
   * stay visible on Workday.
   */
  offPage?: string[];
  /** Human label for the detected wizard step, when one could be determined. */
  currentStep?: string;
  unmatchedQuestions?: string[];
  /** True when the run ended early because the user pressed Stop. */
  stopped?: boolean;
  error?: string;
};

export type StopRequest = {
  type: "stop";
};

export type StopResponse = {
  ok: boolean;
};

export type UndoRequest = {
  type: "undo";
};

export type UndoResponse = {
  ok: boolean;
  undone: number;
};

/**
 * Asks the content script for a text snapshot of the page's form controls.
 * Developer-tools only — used to write selectors for an ATS that has no stable
 * automation hooks, without having to guess at its markup.
 */
export type DumpFormRequest = {
  type: "dumpForm";
};

export type DumpFormResponse = {
  ok: boolean;
  dump: string;
};

export type ExtensionMessage =
  | AutofillRequest
  | StopRequest
  | UndoRequest
  | DumpFormRequest;
