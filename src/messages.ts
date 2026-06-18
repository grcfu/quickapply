export type AutofillRequest = {
  type: "autofill";
};

export type AutofillResponse = {
  ok: boolean;
  filled: number;
  fields: string[];
  skipped: string[];
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
