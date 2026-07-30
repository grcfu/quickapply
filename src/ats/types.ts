import type { Education, OriginalFile, Profile } from "../types/profile";
import type { WorkdayPage } from "./workdayPages";

/**
 * Which step of a multi-page apply flow this field lives on. Advisory only —
 * see workdayPages.ts. Used to word "not on this step" instead of reporting a
 * misleading "field not found".
 */
type PageScoped = {
  page?: WorkdayPage;
};

export type InputFieldDef = PageScoped & {
  kind: "input";
  selectors: string[];
  labelPatterns?: RegExp[];
  getValue: (profile: Profile) => string | undefined;
};

export type SelectFieldDef = PageScoped & {
  kind: "select";
  /**
   * Direct selectors for the control, tried before label matching. Needed for
   * Workday, whose dropdowns are buttons identified by `data-automation-id`.
   */
  selectors?: string[];
  labelPatterns: RegExp[];
  getValue: (profile: Profile) => string | undefined;
};

export type MultiCheckboxFieldDef = PageScoped & {
  kind: "multi-checkbox";
  labelPatterns: RegExp[];
  getValues: (profile: Profile) => string[] | undefined;
};

export type FileFieldDef = PageScoped & {
  kind: "file";
  selectors: string[];
  labelPatterns?: RegExp[];
  getFile: (profile: Profile) => OriginalFile | undefined;
};

/**
 * One input that accepts many values, each of which must be typed and then
 * chosen from the prompt list it opens. Workday's Skills field works this way:
 * writing "Python, React" as raw text leaves the field empty on submit.
 */
export type MultiTypeaheadFieldDef = PageScoped & {
  kind: "multi-typeahead";
  selectors?: string[];
  labelPatterns: RegExp[];
  getValues: (profile: Profile) => string[] | undefined;
};

/** A field inside one panel of a repeating section, read from that entry. */
export type EntrySubFieldDef =
  | {
      kind: "input";
      selectors: string[];
      labelPatterns?: RegExp[];
      getValue: (entry: Education) => string | undefined;
    }
  | {
      kind: "dropdown";
      selectors?: string[];
      labelPatterns: RegExp[];
      getValue: (entry: Education) => string | undefined;
    }
  | {
      kind: "typeahead";
      selectors?: string[];
      labelPatterns: RegExp[];
      getValue: (entry: Education) => string | undefined;
    }
  | {
      kind: "month-year";
      /** Containers holding Workday's split month/year spinner inputs. */
      selectors: string[];
      labelPatterns?: RegExp[];
      getValue: (entry: Education) => string | undefined;
    };

/**
 * Workday renders education as a repeating panel set behind an "Add" button —
 * there is no education field in the DOM until you click Add. Filling it means
 * creating one panel per profile entry, then filling each panel in isolation so
 * entry 2's school doesn't land in entry 1's input.
 *
 * Deliberately concrete to `Education` rather than generic: Experience will want
 * a parallel def, and generics here would erase to `unknown` at the `FieldDef`
 * union boundary and cost more than they save.
 */
export type EducationGroupFieldDef = PageScoped & {
  kind: "education-group";
  containerSelectors: string[];
  containerHeadingPatterns?: RegExp[];
  addButtonSelectors: string[];
  addButtonLabelPatterns?: RegExp[];
  panelSelectors: string[];
  getEntries: (profile: Profile) => Education[] | undefined;
  subFields: Record<string, EntrySubFieldDef>;
};

export type FieldDef =
  | InputFieldDef
  | SelectFieldDef
  | MultiCheckboxFieldDef
  | FileFieldDef
  | MultiTypeaheadFieldDef
  | EducationGroupFieldDef;
