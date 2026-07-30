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
  error?: string;
};

export type UndoRequest = {
  type: "undo";
};

export type UndoResponse = {
  ok: boolean;
  undone: number;
};

export type ExtensionMessage = AutofillRequest | UndoRequest;
