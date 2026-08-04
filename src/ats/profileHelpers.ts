import type {
  Experience,
  OriginalFile,
  Profile,
  Project,
  ResumeProfile,
} from "../types/profile";

function pickResume(profile: Profile): ResumeProfile | undefined {
  const resumes = profile.resumes ?? [];
  if (resumes.length === 0) return undefined;
  const defaultId = profile.settings?.defaultResumeId;
  if (defaultId) {
    const found = resumes.find((r) => r.id === defaultId);
    if (found) return found;
  }
  return resumes[0];
}

export function pickResumeFile(profile: Profile): OriginalFile | undefined {
  return pickResume(profile)?.originalFile;
}

/**
 * Renders a tri-state boolean as a Yes/No answer, or undefined to leave the
 * question alone.
 *
 * Guards against null as well as undefined: `importProfile` validates only the
 * envelope, not field types, so a hand-edited or re-imported JSON can carry
 * `"authorizedToWorkInUS": null`. A bare falsy check would then answer "No" to a
 * work-authorization question the user never actually answered.
 */
export function yesNo(
  value: boolean | null | undefined,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return value ? "Yes" : "No";
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * Skills the user explicitly curated win; otherwise fall back to whatever the
 * resume parser pulled off the default resume, so Workday's skills section has
 * something to work with even for profiles saved before `Profile.skills`
 * existed.
 */
export function pickSkills(profile: Profile): string[] | undefined {
  const explicit = (profile.skills ?? []).map((s) => s.trim()).filter(Boolean);
  if (explicit.length > 0) return dedupe(explicit);
  const parsed = (pickResume(profile)?.parsedData?.skills ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  return parsed.length > 0 ? dedupe(parsed) : undefined;
}

/**
 * TikTok asks for a single "Name" field rather than first/last. Preferred name
 * is deliberately not used — this sits under "Basic Information" next to the
 * legal contact details.
 */
export function fullName(profile: Profile): string | undefined {
  const name = profile.identity?.legalName;
  const parts = [name?.first, name?.middle, name?.last]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * Curated identity entries win; otherwise fall back to whatever the resume
 * parser pulled off the default resume, same rule as `pickSkills`.
 */
export function pickExperiences(profile: Profile): Experience[] {
  const explicit = profile.identity?.experiences ?? [];
  if (explicit.length > 0) return explicit;
  return pickResume(profile)?.parsedData?.experiences ?? [];
}

/*
 * "Intern", "Internship", "Co-op". Anchored on word boundaries so "Internal
 * Tools Engineer" doesn't get filed as an internship.
 */
const INTERN_TITLE = /\b(intern|interns|internship|co-?op)\b/i;

export function isInternship(entry: Experience): boolean {
  return INTERN_TITLE.test(entry.title ?? "");
}

/**
 * TikTok splits its form into "Work Experience" and "Internship Experience" and
 * expects a role in exactly one of them. Nothing in `Profile` records which is
 * which, so it's inferred from the job title — the same signal a human reads off
 * the resume.
 */
export function pickWorkExperiences(profile: Profile): Experience[] | undefined {
  const out = pickExperiences(profile).filter((e) => !isInternship(e));
  return out.length > 0 ? out : undefined;
}

export function pickInternships(profile: Profile): Experience[] | undefined {
  const out = pickExperiences(profile).filter(isInternship);
  return out.length > 0 ? out : undefined;
}

/**
 * Curated projects win; otherwise fall back to whatever the resume parser found.
 * Same rule as `pickSkills` and `pickExperiences`.
 */
export function pickProjects(profile: Profile): Project[] | undefined {
  const explicit = profile.identity?.projects ?? [];
  const source =
    explicit.length > 0
      ? explicit
      : (pickResume(profile)?.parsedData?.projects ?? []);
  const out = source.filter(
    (p) => p.name?.trim() || p.description?.trim() || p.url?.trim(),
  );
  return out.length > 0 ? out : undefined;
}

/**
 * A project's description with its tech stack prepended, for forms that have no
 * stack field. Returns undefined when there's nothing to write, so the field is
 * reported as skipped rather than filled with an empty string.
 */
export function projectDescription(project: Project): string | undefined {
  const tech = (project.tech ?? []).map((t) => t.trim()).filter(Boolean);
  const parts = [
    tech.length > 0 ? `Tech: ${tech.join(", ")}` : "",
    project.description?.trim() ?? "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export type MonthYear = { month?: string; day?: string; year: string };

/**
 * Parses the loose date strings a profile can hold into Workday's split date
 * inputs. Handles "2026-05", "05/2026", "May 2026", "2025-06-15", "06/15/2025",
 * and a bare "2026".
 *
 * `day` is only set when the source actually carries one — certification dates
 * are MM/DD/YYYY on Workday, and guessing a day would put a fabricated date on a
 * real application. Returns null without a 4-digit year.
 */
export function parseMonthYear(raw: string | undefined): MonthYear | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  const isoDay = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoDay) {
    return {
      year: isoDay[1],
      month: String(Number(isoDay[2])),
      day: String(Number(isoDay[3])),
    };
  }

  const usDay = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (usDay) {
    return {
      year: usDay[3],
      month: String(Number(usDay[1])),
      day: String(Number(usDay[2])),
    };
  }

  const iso = text.match(/^(\d{4})[-/](\d{1,2})$/);
  if (iso) return { year: iso[1], month: String(Number(iso[2])) };

  const slash = text.match(/^(\d{1,2})[-/](\d{4})$/);
  if (slash) return { year: slash[2], month: String(Number(slash[1])) };

  const yearMatch = text.match(/\b(?:19|20)\d{2}\b/);
  if (!yearMatch) return null;
  const year = yearMatch[0];

  const lower = text.toLowerCase();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const name = MONTH_NAMES[i];
    if (lower.includes(name) || lower.includes(name.slice(0, 3))) {
      return { year, month: String(i + 1) };
    }
  }
  return { year };
}
