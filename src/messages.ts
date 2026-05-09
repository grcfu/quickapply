export type AutofillRequest = {
  type: "autofill";
};

export type AutofillResponse = {
  ok: boolean;
  filled: number;
  fields: string[];
  skipped: string[];
  error?: string;
};

export type ExtensionMessage = AutofillRequest;
