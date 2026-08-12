import type {
  Award,
  Certification,
  Education,
  Experience,
  OriginalFile,
  Profile,
  Project,
} from "../types/profile";
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
  /**
   * A list means "any of these answers is correct, best first" — for questions
   * whose option wording varies by tenant ("Company Website" vs "Careers
   * Website"). The matchers try every candidate at each tier before loosening;
   * see `toCandidates` in fillField.ts.
   */
  getValue: (profile: Profile) => string | string[] | undefined;
  /**
   * Set false to refuse the token-overlap tier, leaving the field unfilled
   * instead of picking a merely related option. For questions where a near miss
   * would state something untrue — "How did you hear about us?" landing on
   * "Career Fair" — rather than approximate it.
   */
  fuzzy?: boolean;
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
export type EntrySubFieldDef<T> =
  | {
      kind: "input";
      selectors: string[];
      labelPatterns?: RegExp[];
      getValue: (entry: T) => string | undefined;
    }
  | {
      kind: "dropdown";
      selectors?: string[];
      labelPatterns: RegExp[];
      getValue: (entry: T) => string | undefined;
    }
  | {
      kind: "typeahead";
      selectors?: string[];
      labelPatterns: RegExp[];
      getValue: (entry: T) => string | undefined;
    }
  | {
      kind: "month-year";
      /** Containers holding Workday's split month/year spinner inputs. */
      selectors: string[];
      labelPatterns?: RegExp[];
      getValue: (entry: T) => string | undefined;
    }
  | {
      /**
       * One control holding a whole date range — TikTok's "Start & end date",
       * which renders its digits as spans and keeps the value in a single
       * id-less hidden input.
       *
       * The value encoding isn't discoverable from the markup, so `fillDateRange`
       * tries several and **verifies each against the picker's visible text**,
       * clearing anything the component ignored. That's what makes attempting a
       * guess safe: a miss leaves the field blank and reported, never showing a
       * date the profile doesn't contain.
       */
      kind: "date-range";
      selectors: string[];
      labelPatterns?: RegExp[];
      getRange: (entry: T) => { start?: string; end?: string } | undefined;
    }
  | {
      /** Ticked when getValue returns a truthy string, left alone otherwise. */
      kind: "checkbox";
      selectors: string[];
      labelPatterns?: RegExp[];
      getValue: (entry: T) => string | undefined;
    }
  | {
      kind: "file";
      selectors: string[];
      labelPatterns?: RegExp[];
      getFile: (entry: T) => OriginalFile | undefined;
    };

/**
 * One URL row in a Websites / SNS section — not a profile concept.
 *
 * `kind` names the platform for forms that ask which service a link belongs to
 * (TikTok's SNS section pairs a "Social media" picker with the URL). Workday's
 * Websites section has no such field and leaves it unset.
 */
export type WebsiteEntry = { url?: string; kind?: string };

/**
 * Shared shape for any Add-button-backed repeating section.
 *
 * Workday renders education, work history, and websites as panel sets that do
 * not exist in the DOM until Add is clicked. Filling one means creating a panel
 * per entry, then filling each panel scoped so entry 2 can't overwrite entry 1.
 *
 * Exposed as three concrete kinds rather than one generic arm of `FieldDef`: a
 * generic would erase to `unknown` at the union boundary and lose the entry type
 * that makes `subFields` typecheck.
 */
export type RepeatingGroup<T> = {
  containerSelectors: string[];
  containerHeadingPatterns?: RegExp[];
  addButtonSelectors: string[];
  addButtonLabelPatterns?: RegExp[];
  panelSelectors: string[];
  getEntries: (profile: Profile) => T[] | undefined;
  subFields: Record<string, EntrySubFieldDef<T>>;
};

export type EducationGroupFieldDef = PageScoped &
  RepeatingGroup<Education> & { kind: "education-group" };

export type ExperienceGroupFieldDef = PageScoped &
  RepeatingGroup<Experience> & { kind: "experience-group" };

export type WebsiteGroupFieldDef = PageScoped &
  RepeatingGroup<WebsiteEntry> & { kind: "website-group" };

export type CertificationGroupFieldDef = PageScoped &
  RepeatingGroup<Certification> & { kind: "certification-group" };

export type ProjectGroupFieldDef = PageScoped &
  RepeatingGroup<Project> & { kind: "project-group" };

export type AwardGroupFieldDef = PageScoped &
  RepeatingGroup<Award> & { kind: "award-group" };

export type FieldDef =
  | InputFieldDef
  | SelectFieldDef
  | MultiCheckboxFieldDef
  | FileFieldDef
  | MultiTypeaheadFieldDef
  | EducationGroupFieldDef
  | ExperienceGroupFieldDef
  | WebsiteGroupFieldDef
  | CertificationGroupFieldDef
  | ProjectGroupFieldDef
  | AwardGroupFieldDef;
