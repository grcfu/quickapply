import type { OriginalFile, Profile, ResumeProfile } from "../types/profile";

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

export type MonthYear = { month?: string; year: string };

/**
 * Parses the loose date strings a profile can hold into Workday's split
 * month/year inputs. Handles "2026-05", "05/2026", "May 2026", and a bare
 * "2026". Returns null when there's no 4-digit year, since the year spinner is
 * the only part Workday genuinely requires.
 */
export function parseMonthYear(raw: string | undefined): MonthYear | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

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
