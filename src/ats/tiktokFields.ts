import {
  fullName,
  parseMonthYear,
  pickInternships,
  pickProjects,
  pickResumeFile,
  pickWorkExperiences,
  projectDescription,
  yesNo,
} from "./profileHelpers";
import type { FieldDef, RepeatingGroup } from "./types";
import type { Experience, Profile } from "../types/profile";

/**
 * TikTok / ByteDance careers (lifeattiktok.com, careers.tiktok.com).
 *
 * ByteDance's in-house ATS, not a third-party one. One long page rather than a
 * wizard, but **lazily mounted**: a repeating section's inputs do not exist in
 * the DOM until it has at least one row, so Autofill clicks each section's Add
 * button itself before filling.
 *
 * **The form's own id scheme is the hook.** Every repeating section names its
 * fields `<section>[N].<field>`, 1-based:
 *
 *   education[1].school / .degree / .fieldOfStudy
 *   internship[1].company / .title / .desc
 *   project[1].name / .role / .link / .desc
 *   sns[1].snsType / .link
 *   selfEvaluation[1].selfEvaluation
 *   works[1].link / .desc          (Work Samples — unused, see below)
 *   award[1].title / .desc         (Honors and Awards — unused)
 *   language[1].language / .proficiency  (unused)
 *
 * All of the above were read off a live page. `indexed()` turns one into
 * `[id^="education["][id$="].school"]`, enumerating that field across every row
 * so runAutofill can take the Nth for entry N. This beats label matching
 * outright: `project[2].role` cannot collide with an identically-labelled
 * "Title" in another section, which is the failure mode label patterns invite.
 *
 * Note the names are not what you would guess — the internship section is
 * `internship`, not `internExperience`; description is `desc`; a project's
 * Title is `role` and its URL is `link`. Guessed prefixes were wrong on all
 * three counts, hence the label patterns kept as a fallback.
 *
 * Two component libraries are in play: `atsx-*` for the form, `ud-*` for the
 * work-authorization questions. In both, a "select" is a `role="combobox"` div
 * wrapping an `input.atsx-select-search__field` that carries the id — so School,
 * Degree, Social media, Language and Proficiency are searchable typeaheads. They
 * only accept a value chosen from the list they open, the same trap as Workday's
 * Skills box; writing text leaves them empty on submit.
 */

const ADD_BUTTON_LABELS = [/^add$/i, /^\+\s*add$/i, /^add another$/i];

/*
 * "Start & end date" is one segmented picker per row: the digits render as
 * spans, and the value lives in an id-less hidden input. There's no id to scope
 * by, so this relies on the section container plus the row index — which is
 * enough, because the selector is unique to date pickers.
 */
const DATE_RANGE_SELECTORS = [
  "input.atsx-date-picker-period-hidden-input",
  '[class*="date-picker-period-hidden-input"]',
  '[class*="date-picker"] input',
];

const DATE_RANGE_LABELS = [/^start ?(&|and) ?end date\*?$/i, /^yyyy-mm$/i];

/** Enumerates one sub-field across every row of a 1-based indexed section. */
function indexed(section: string, field: string): string {
  return `[id^="${section}["][id$="].${field}"]`;
}

/*
 * Anchoring on `section[` rather than `section` matters: `work[` cannot match
 * `works[1].link`, which belongs to the unrelated Work Samples section.
 */
function anyOf(sections: string[], field: string): string[] {
  return sections.map((s) => indexed(s, field));
}

/**
 * Shared shape of TikTok's role sections (Work Experience and Internship
 * Experience). They differ only in which entries feed them, their section title,
 * and their id prefix.
 *
 * Dates go through `kind: "date-range"`, which verifies the write against the
 * picker's rendered digits and clears it if the component didn't absorb it — so
 * an unrecognised value encoding leaves the field blank and reported rather than
 * showing a date the profile doesn't contain.
 */
function roleGroup(
  titlePatterns: RegExp[],
  idSections: string[],
  getEntries: (p: Profile) => Experience[] | undefined,
): RepeatingGroup<Experience> {
  return {
    /* No section-level id exists; the title is the only anchor for the Add button. */
    containerSelectors: [],
    containerHeadingPatterns: titlePatterns,
    addButtonSelectors: [],
    addButtonLabelPatterns: ADD_BUTTON_LABELS,
    /* No per-entry panel wrapper — rows are told apart by their id index. */
    panelSelectors: [],
    getEntries,
    subFields: {
      company: {
        kind: "input",
        selectors: anyOf(idSections, "company"),
        labelPatterns: [/^company name\*?$/i, /^company\*?$/i],
        getValue: (e) => e.company,
      },
      title: {
        kind: "input",
        selectors: anyOf(idSections, "title"),
        labelPatterns: [/^title\*?$/i, /^job title\*?$/i, /^position\*?$/i],
        getValue: (e) => e.title,
      },
      description: {
        kind: "input",
        selectors: [
          ...anyOf(idSections, "desc"),
          ...anyOf(idSections, "description"),
        ],
        labelPatterns: [/^description\*?$/i],
        getValue: (e) => e.description,
      },
      dates: {
        kind: "date-range",
        selectors: DATE_RANGE_SELECTORS,
        labelPatterns: DATE_RANGE_LABELS,
        getRange: (e) => ({ start: e.startDate, end: e.endDate }),
      },
    },
  };
}

export const tiktokFields: Record<string, FieldDef> = {
  /* ---------- Application Information / Basic Information ---------- */
  /*
   * There are two `data-cy="inputUpload"` file inputs on the page: the resume at
   * the top and the Work Samples attachment further down. First match wins,
   * which is the resume.
   */
  resume: {
    kind: "file",
    selectors: [
      'input[type="file"][data-cy="inputUpload"]',
      'input[type="file"][accept*="pdf"]',
      'input[type="file"]',
    ],
    labelPatterns: [/^resume\*?$/i, /^cv\*?$/i, /^resume\/cv\*?$/i],
    getFile: (p) => pickResumeFile(p),
  },
  name: {
    kind: "input",
    selectors: ["input#name", 'input[data-test="nameInput"]'],
    labelPatterns: [/^name\*?$/i, /^full name\*?$/i],
    getValue: (p) => fullName(p),
  },
  /*
   * The phone row is two controls: a country-code combobox (label "+1") and the
   * number. The number carries no id and resolves no label, so the class is the
   * only handle — and it must be specific enough not to hit the prefix box.
   */
  mobile: {
    kind: "input",
    selectors: [
      "input.atsx-phone-input",
      '[class*="phone-input"]',
      'input[type="tel"]',
    ],
    labelPatterns: [/^mobile\*?$/i, /^phone( number)?\*?$/i],
    getValue: (p) => p.identity?.contact?.phone,
  },
  email: {
    kind: "input",
    selectors: ["input#email", 'input[data-test="emailInput"]'],
    labelPatterns: [/^email( address)?\*?$/i],
    getValue: (p) => p.identity?.contact?.email,
  },

  /* ---------- roles ---------- */
  /*
   * The Work Experience section was empty on every capture, so its id prefix is
   * the one still unconfirmed. Each plausible name is listed and the label
   * fallback applies within the section, so a wrong guess degrades to label
   * matching rather than breaking the section.
   */
  workExperience: {
    kind: "experience-group",
    ...roleGroup(
      [/^work experience$/i],
      ["work", "workExperience", "workExp", "employment"],
      (p) => pickWorkExperiences(p),
    ),
  },
  /* A separate section with identical labels; routed by job title. */
  internshipExperience: {
    kind: "experience-group",
    ...roleGroup([/^internship experience$/i], ["internship"], (p) =>
      pickInternships(p),
    ),
  },

  education: {
    kind: "education-group",
    containerSelectors: [],
    containerHeadingPatterns: [/^education$/i, /^education experience$/i],
    addButtonSelectors: [],
    addButtonLabelPatterns: ADD_BUTTON_LABELS,
    panelSelectors: [],
    getEntries: (p) => p.identity?.educations,
    subFields: {
      /* Comboboxes: the id is on the inner atsx-select-search__field. */
      school: {
        kind: "typeahead",
        selectors: [indexed("education", "school")],
        labelPatterns: [/^school name\*?$/i, /^school\*?$/i, /^university\*?$/i],
        getValue: (e) => e.school,
      },
      degree: {
        kind: "typeahead",
        selectors: [indexed("education", "degree")],
        labelPatterns: [/^degree\*?$/i],
        getValue: (e) => e.degree,
      },
      /* This one really is a plain text input. */
      fieldOfStudy: {
        kind: "input",
        selectors: [indexed("education", "fieldOfStudy")],
        labelPatterns: [/^field of study\*?$/i, /^major\*?$/i],
        getValue: (e) => e.fieldOfStudy,
      },
    },
  },

  projects: {
    kind: "project-group",
    containerSelectors: [],
    containerHeadingPatterns: [/^project experience$/i, /^projects?$/i],
    addButtonSelectors: [],
    addButtonLabelPatterns: ADD_BUTTON_LABELS,
    panelSelectors: [],
    getEntries: (p) => pickProjects(p),
    subFields: {
      name: {
        kind: "input",
        selectors: [indexed("project", "name")],
        labelPatterns: [/^project name\*?$/i],
        getValue: (e) => e.name,
      },
      /* The field labelled "Title" is `role` in the form's own naming. */
      role: {
        kind: "input",
        selectors: [indexed("project", "role")],
        labelPatterns: [/^title\*?$/i],
        getValue: (e) => e.role,
      },
      url: {
        kind: "input",
        selectors: [indexed("project", "link"), indexed("project", "url")],
        labelPatterns: [/^project url\*?$/i, /^url\*?$/i],
        getValue: (e) => e.url,
      },
      /* Tech stack folded in — this form has no field for it. */
      description: {
        kind: "input",
        selectors: [indexed("project", "desc")],
        labelPatterns: [/^description\*?$/i],
        getValue: (e) => projectDescription(e),
      },
      dates: {
        kind: "date-range",
        selectors: DATE_RANGE_SELECTORS,
        labelPatterns: DATE_RANGE_LABELS,
        getRange: (e) => ({ start: e.startDate, end: e.endDate }),
      },
    },
  },

  /*
   * SNS pairs a "Social media" picker with a URL, so each profile link becomes
   * one row. Reuses `website-group`, whose entry type carries the optional
   * platform name for exactly this shape.
   */
  sns: {
    kind: "website-group",
    containerSelectors: [],
    containerHeadingPatterns: [/^sns$/i, /^social media$/i],
    addButtonSelectors: [],
    addButtonLabelPatterns: ADD_BUTTON_LABELS,
    panelSelectors: [],
    getEntries: (p) => {
      const links = p.identity?.links;
      return [
        { kind: "LinkedIn", url: links?.linkedin },
        { kind: "GitHub", url: links?.github },
        { kind: "Personal website", url: links?.portfolio },
      ].filter((e) => Boolean(e.url?.trim()));
    },
    subFields: {
      snsType: {
        kind: "typeahead",
        selectors: [indexed("sns", "snsType")],
        labelPatterns: [/^social media\*?$/i, /^platform\*?$/i, /^type\*?$/i],
        getValue: (e) => e.kind,
      },
      url: {
        kind: "input",
        selectors: [indexed("sns", "link")],
        labelPatterns: [/^url ?\/ ?id\*?$/i, /^url\*?$/i],
        getValue: (e) => e.url,
      },
    },
  },

  /*
   * Honors and Awards. Title and Description carry ids; the Year box does not,
   * so it's found by `placeholder="YYYY"` — unique to this section, since the
   * date *ranges* elsewhere are segmented pickers rather than plain inputs.
   */
  awards: {
    kind: "award-group",
    containerSelectors: [],
    containerHeadingPatterns: [/^honors? and awards?$/i, /^awards?$/i],
    addButtonSelectors: [],
    addButtonLabelPatterns: ADD_BUTTON_LABELS,
    panelSelectors: [],
    getEntries: (p) => p.identity?.awards,
    subFields: {
      title: {
        kind: "input",
        selectors: [indexed("award", "title")],
        labelPatterns: [/^title\*?$/i],
        getValue: (a) => a.title,
      },
      /*
       * A bare YYYY. `parseMonthYear` pulls the year out of free-form text
       * ("Class of 2028", "Summer 2024") and returns null for "All Semesters",
       * which leaves the box empty rather than inventing a year.
       */
      year: {
        kind: "input",
        selectors: [
          'input[placeholder="YYYY"]',
          'input[placeholder*="YYYY" i]',
        ],
        labelPatterns: [/^year\*?$/i],
        getValue: (a) => parseMonthYear(a.date)?.year,
      },
      /*
       * The form has no issuer field, so the granting body is folded into the
       * description rather than dropped.
       */
      description: {
        kind: "input",
        selectors: [indexed("award", "desc")],
        labelPatterns: [/^description\*?$/i],
        getValue: (a) =>
          [a.issuer?.trim(), a.description?.trim()]
            .filter(Boolean)
            .join(" — ") || undefined,
      },
    },
  },

  /* ---------- single fields ---------- */
  selfIntroduction: {
    kind: "input",
    selectors: [indexed("selfEvaluation", "selfEvaluation")],
    labelPatterns: [/^self.?introduction\*?$/i, /^about (me|yourself)\*?$/i],
    getValue: (p) =>
      p.answers?.find((a) =>
        /self.?introduction|about (me|yourself)/i.test(a.question),
      )?.answer,
  },

  /*
   * `ud-*` search comboboxes — not radios, not `<select>`s. A `<label>` with the
   * question text does exist, but enough wrappers separate it from the input
   * that control-first label resolution can't bridge the gap; these are found by
   * `findControlNearLabel`, the last tier in fillSelectField.
   */
  workAuthUS: {
    kind: "select",
    selectors: [],
    labelPatterns: [
      /legally authorized to work in the us without restriction/i,
      /legally authorized to work in (the )?(us|u\.s\.|united states)/i,
    ],
    getValue: (p) => yesNo(p.identity?.workAuth?.authorizedToWorkInUS),
  },
  sponsorship: {
    kind: "select",
    selectors: [],
    labelPatterns: [
      /require visa sponsorship or a visa transfer/i,
      /require.*sponsorship/i,
    ],
    getValue: (p) => yesNo(p.identity?.workAuth?.requiresSponsorship),
  },

  /*
   * Still unmapped, blocked on the profile schema rather than on selectors:
   *   works[]     Work Samples     — no profile field
   *   language[]  Language Skills  — no profile field
   * Adding either means extending `Profile` first.
   */
};
