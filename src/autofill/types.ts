import type { OriginalFile, Profile } from "../types/profile";

export type InputFieldDef = {
  kind: "input";
  selectors: string[];
  labelPatterns?: RegExp[];
  getValue: (profile: Profile) => string | undefined;
};

export type SelectFieldDef = {
  kind: "select";
  labelPatterns: RegExp[];
  getValue: (profile: Profile) => string | undefined;
};

export type MultiCheckboxFieldDef = {
  kind: "multi-checkbox";
  labelPatterns: RegExp[];
  getValues: (profile: Profile) => string[] | undefined;
};

export type FileFieldDef = {
  kind: "file";
  selectors: string[];
  labelPatterns?: RegExp[];
  getFile: (profile: Profile) => OriginalFile | undefined;
};

export type FieldDef =
  | InputFieldDef
  | SelectFieldDef
  | MultiCheckboxFieldDef
  | FileFieldDef;
