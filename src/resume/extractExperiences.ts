import type { Experience } from "../types/profile";

/**
 * Pulls work/internship entries out of the plain text `extractTextFromPdf`
 * produces.
 *
 * This is regex heuristics over a layout that was designed for human eyes, so
 * it is deliberately conservative: an entry is only emitted when a **date
 * range** anchors it, and an entry with neither a company nor a title is
 * dropped rather than guessed at. Getting company/title/dates right and the
 * description roughly right is the goal; `ResumeManager` shows the result for
 * confirmation before it ever reaches an application form.
 */

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/** "May 2025", "Sept. 2025", "05/2025", "2025". */
const DATE = `(?:${MONTH}\\.?\\s*,?\\s*\\d{4}|\\d{1,2}\\s*[/-]\\s*\\d{4}|\\d{4})`;
const OPEN_ENDED = "(?:present|current|now|ongoing)";

/*
 * Anchored on the range, not on a lone date: a bare "2025" appears all over a
 * resume (graduation years, project years, copyright lines), but "2025 - 2026"
 * on its own line is nearly always an entry header.
 */
const RANGE = new RegExp(
  `(${DATE})\\s*(?:--|[-–—‐~]|\\bto\\b|\\buntil\\b|\\bthrough\\b)\\s*(${OPEN_ENDED}|${DATE})`,
  "i",
);

/*
 * Headings that open an experience section. "Relevant Experience" and
 * "Internship Experience" are both common on student resumes, and TikTok wants
 * the two kinds split anyway — `isInternship` does that downstream off the
 * title, so both headings feed one list here.
 */
const EXPERIENCE_HEADING =
  /^(?:(?:work|professional|relevant|industry|research|technical|other)\s+)?(?:experiences?|employment(?:\s+history)?|internships?|work\s+history)\b/i;

/** Any other section heading ends the run of experience entries. */
const OTHER_HEADING =
  /^(?:education|projects?|technical\s+skills|skills|awards?|honou?rs?|certifications?|licen[cs]es?|leadership|activities|extra-?curriculars?|publications?|volunteer(?:ing)?|interests|references|coursework|relevant\s+coursework|summary|objective|about|contact|languages?|affiliations?|organizations?)\b/i;

/*
 * Words that mark a fragment as a job title rather than an employer. Used only
 * to decide which side of "X — Y" is which; when neither side matches, the
 * company-first convention wins because that is what most resumes use.
 */
const ROLE_WORD =
  /\b(?:intern(?:ship)?|co-?op|engineer|developer|programmer|analyst|scientist|researcher|research|manager|director|lead|architect|consultant|designer|administrator|technician|specialist|coordinator|associate|assistant|instructor|tutor|teaching|ta|fellow|ambassador|president|founder|co-?founder|owner|chair|treasurer|secretary|volunteer|apprentice|trainee|extern|freelance|contractor)\b/i;

/** "St. Louis, MO", "San Francisco, California", "Remote", "Hybrid". */
const LOCATION =
  /^(?:remote|hybrid|on-?site|[A-Za-z.'\- ]{2,30},\s*(?:[A-Z]{2}|[A-Za-z.'\- ]{2,30}))$/i;

const BULLET = /^[\s]*[•·▪◦‣●○*+‧⁃–—-]\s+/;

const MAX_ENTRIES = 12;
const MAX_DESCRIPTION = 2000;
/** A header fragment longer than this is prose, not a company or a title. */
const MAX_FRAGMENT = 70;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isHeading(line: string): boolean {
  if (line.length > 40) return false;
  if (BULLET.test(line)) return false;
  return EXPERIENCE_HEADING.test(line) || OTHER_HEADING.test(line);
}

/**
 * Every line belonging to an experience section, in order, with the heading
 * lines themselves dropped. A resume may have more than one such section
 * ("Work Experience" and "Internship Experience"); their lines are concatenated
 * because the split is re-derived from the job title downstream.
 */
function experienceSectionLines(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim());
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (!line) continue;
    if (isHeading(line)) {
      /* A heading that is *only* a heading switches sections. One carrying a
       * date range is really an entry header that happens to start with a
       * matching word, so it falls through to be parsed as an entry. */
      if (!RANGE.test(line)) {
        inSection = EXPERIENCE_HEADING.test(line);
        continue;
      }
    }
    if (inSection) out.push(line);
  }
  return out;
}

function tidyDate(raw: string): string {
  const text = collapse(raw).replace(/\.$/, "");
  if (new RegExp(`^${OPEN_ENDED}$`, "i").test(text)) return "Present";
  return text;
}

/**
 * Splits an entry header into its fragments. Only strong separators count —
 * a comma is not one, because "St. Louis, MO" and "Health XR, LLC" both use it
 * and splitting there would shred them.
 */
function splitFragments(text: string): string[] {
  return text
    .split(/\s*(?:[|·•‧]|--|[—–])\s*|\s{2,}|\s+(?:at|@)\s+/i)
    .map((part) => part.replace(/^[\s,;:.\-–—|]+|[\s,;:\-–—|]+$/g, "").trim())
    .filter((part) => part.length > 1 && part.length <= MAX_FRAGMENT);
}

/**
 * Assigns header fragments to company / title / location.
 *
 * The company-vs-title call is the one real guess here: a resume can write
 * either order and the text carries no marker for which is which. A fragment
 * naming a role wins the title slot; with no signal either way, the first
 * fragment is taken as the company, which is the more common convention.
 */
function assignFragments(fragments: string[]): Experience {
  const entry: Experience = {};
  const rest: string[] = [];
  for (const fragment of fragments) {
    if (!entry.location && LOCATION.test(fragment) && !ROLE_WORD.test(fragment)) {
      entry.location = fragment;
      continue;
    }
    rest.push(fragment);
  }
  if (rest.length === 0) return entry;
  if (rest.length === 1) {
    if (ROLE_WORD.test(rest[0])) entry.title = rest[0];
    else entry.company = rest[0];
    return entry;
  }
  const roleIndex = rest.findIndex((f) => ROLE_WORD.test(f));
  const nonRoleIndex = rest.findIndex((f) => !ROLE_WORD.test(f));
  if (roleIndex >= 0 && nonRoleIndex >= 0) {
    entry.title = rest[roleIndex];
    entry.company = rest[nonRoleIndex];
  } else {
    entry.company = rest[0];
    entry.title = rest[1];
  }
  return entry;
}

type Header = {
  /** Index of the first line consumed by this header. */
  start: number;
  /** Index after the last line consumed by this header. */
  end: number;
  entry: Experience;
};

/**
 * Builds one entry's header from the line carrying its date range, borrowing
 * the line above or below when the header is split across lines — the
 * "Company / Title-underneath" layout is as common as the single-line one.
 */
function readHeader(lines: string[], index: number, match: RegExpMatchArray): Header {
  const entry: Experience = {
    startDate: tidyDate(match[1]),
    endDate: tidyDate(match[2]),
  };
  const sameLine = lines[index].replace(match[0], " ");
  const fragments = splitFragments(sameLine);
  let start = index;
  let end = index + 1;

  /* Line above: only when the date line carried nothing but dates, so a
   * previous entry's last bullet can never be mistaken for a company. */
  if (fragments.length === 0 && index > 0) {
    const above = lines[index - 1];
    if (!BULLET.test(above) && !RANGE.test(above) && above.length <= MAX_FRAGMENT) {
      fragments.push(...splitFragments(above));
      start = index - 1;
    }
  }

  /* Line below: only a role-looking one, so the first sentence of an
   * unbulleted description is not swallowed as a title. */
  if (fragments.length === 1 && index + 1 < lines.length) {
    const below = lines[index + 1];
    if (
      !BULLET.test(below) &&
      !RANGE.test(below) &&
      below.length <= MAX_FRAGMENT &&
      ROLE_WORD.test(below) &&
      !ROLE_WORD.test(fragments[0])
    ) {
      fragments.push(...splitFragments(below));
      end = index + 2;
    }
  }

  return { start, end, entry: { ...assignFragments(fragments), ...entry } };
}

function joinDescription(lines: string[]): string | undefined {
  const text = lines
    .map((line) => line.replace(BULLET, "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_DESCRIPTION)
    .trim();
  return text || undefined;
}

export function extractExperiences(text: string): Experience[] | undefined {
  const lines = experienceSectionLines(text);
  if (lines.length === 0) return undefined;

  const headers: Header[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(RANGE);
    if (!match) continue;
    const header = readHeader(lines, i, match);
    /* A header that borrowed the line above must not overlap the entry before
     * it, which would duplicate that line into two entries. */
    const previous = headers[headers.length - 1];
    if (previous && header.start < previous.end) header.start = previous.end;
    headers.push(header);
    i = header.end - 1;
  }

  const out: Experience[] = [];
  for (let h = 0; h < headers.length && out.length < MAX_ENTRIES; h++) {
    const header = headers[h];
    const nextStart = headers[h + 1]?.start ?? lines.length;
    const description = joinDescription(lines.slice(header.end, nextStart));
    const entry = description
      ? { ...header.entry, description }
      : header.entry;
    if (!entry.company && !entry.title) continue;
    out.push(entry);
  }
  return out.length > 0 ? out : undefined;
}
