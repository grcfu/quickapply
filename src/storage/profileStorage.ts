import type {
  AnswerEntry,
  DeepPartial,
  Education,
  Experience,
  ParsedResumeData,
  Profile,
  ResumeProfile,
} from "../types/profile";

const STORAGE_KEY = "quickapply";
const DRAFT_KEY = "quickapply_onboarding_draft";
const CURRENT_SCHEMA_VERSION = 1;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

export type OnboardingDraft = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  citizenship?: string;
  workAuthUS?: string;
  sponsorship?: string;
  educations?: Education[];
  experiences?: Experience[];
  /** Raw comma-separated text, so partial typing survives a draft save. */
  skills?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  gender?: string;
  pronouns?: string;
  veteranStatus?: string;
  disabilityStatus?: string;
  raceEthnicity?: string[];
  updatedAt: number;
};

type StorageEnvelope = {
  schemaVersion: number;
  profile: Profile;
};

function now(): number {
  return Date.now();
}

function emptyProfile(): Profile {
  const t = now();
  return {
    metadata: {
      createdAt: t,
      lastUpdatedAt: t,
      version: CURRENT_SCHEMA_VERSION,
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (patch === undefined) return base;
  if (!isPlainObject(patch)) return patch as unknown as T;
  if (!isPlainObject(base)) return patch as unknown as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, patchVal] of Object.entries(patch)) {
    const baseVal = (base as Record<string, unknown>)[key];
    if (isPlainObject(patchVal) && isPlainObject(baseVal)) {
      result[key] = deepMerge(baseVal, patchVal as DeepPartial<typeof baseVal>);
    } else {
      result[key] = patchVal;
    }
  }
  return result as T;
}

function approximateBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

async function readEnvelope(): Promise<StorageEnvelope | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const env = result[STORAGE_KEY] as StorageEnvelope | undefined;
  return env ?? null;
}

async function writeEnvelope(env: StorageEnvelope): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: env });
}

export async function getProfile(): Promise<Profile | null> {
  const env = await readEnvelope();
  return env ? env.profile : null;
}

export async function saveProfile(profile: Profile): Promise<void> {
  const stamped: Profile = {
    ...profile,
    metadata: {
      createdAt: profile.metadata?.createdAt ?? now(),
      lastUpdatedAt: now(),
      version: CURRENT_SCHEMA_VERSION,
    },
  };
  await writeEnvelope({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: stamped,
  });
}

export async function updateProfile(
  partial: DeepPartial<Profile>,
): Promise<Profile> {
  const existing = (await getProfile()) ?? emptyProfile();
  const merged = deepMerge(existing, partial);
  await saveProfile(merged);
  return merged;
}

export async function clearProfile(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function addResume(resume: ResumeProfile): Promise<void> {
  const existing = (await getProfile()) ?? emptyProfile();
  const resumes = existing.resumes ?? [];
  const candidate: Profile = {
    ...existing,
    resumes: [...resumes.filter((r) => r.id !== resume.id), resume],
  };
  const size = approximateBytes(candidate);
  if (size > MAX_TOTAL_BYTES) {
    const mb = (size / 1024 / 1024).toFixed(2);
    throw new Error(
      `Adding this resume would exceed the 8MB profile budget (would be ${mb}MB). Remove an existing resume first.`,
    );
  }
  await saveProfile(candidate);
}

/**
 * Attaches (or clears, with `undefined`) the fields parsed off a resume.
 *
 * Separate from `addResume` because parsed data only lands after the user
 * confirms it in `ResumeManager` — an upload saves the file immediately, but
 * `pickSkills` / `pickExperiences` merge this into what gets typed onto a real
 * application, so a bad parse must not take effect unreviewed.
 *
 * Not routed through `updateProfile`: a deep merge would union the old and new
 * skill arrays element-wise, so clearing or shortening a parsed list would be
 * impossible.
 */
export async function setResumeParsedData(
  resumeId: string,
  parsedData: ParsedResumeData | undefined,
): Promise<void> {
  const existing = await getProfile();
  if (!existing) return;
  const resumes = (existing.resumes ?? []).map((r) =>
    r.id === resumeId ? { ...r, parsedData, updatedAt: now() } : r,
  );
  await saveProfile({ ...existing, resumes });
}

export async function removeResume(resumeId: string): Promise<void> {
  const existing = await getProfile();
  if (!existing) return;
  const resumes = (existing.resumes ?? []).filter((r) => r.id !== resumeId);
  await saveProfile({ ...existing, resumes });
}

export async function addAnswer(answer: AnswerEntry): Promise<void> {
  const existing = (await getProfile()) ?? emptyProfile();
  const answers = existing.answers ?? [];
  const updated: Profile = {
    ...existing,
    answers: [...answers.filter((a) => a.id !== answer.id), answer],
  };
  await saveProfile(updated);
}

export async function removeAnswer(answerId: string): Promise<void> {
  const existing = await getProfile();
  if (!existing) return;
  const answers = (existing.answers ?? []).filter((a) => a.id !== answerId);
  await saveProfile({ ...existing, answers });
}

export async function saveOnboardingDraft(
  draft: OnboardingDraft,
): Promise<void> {
  await chrome.storage.local.set({ [DRAFT_KEY]: draft });
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft | null> {
  const result = await chrome.storage.local.get(DRAFT_KEY);
  return (result[DRAFT_KEY] as OnboardingDraft | undefined) ?? null;
}

export async function clearOnboardingDraft(): Promise<void> {
  await chrome.storage.local.remove(DRAFT_KEY);
}

export async function exportProfile(): Promise<string> {
  const env = (await readEnvelope()) ?? {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: emptyProfile(),
  };
  return JSON.stringify(env, null, 2);
}

export async function importProfile(json: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON: ${msg}`, { cause: err });
  }
  if (!isPlainObject(parsed)) {
    throw new Error("Invalid profile: top-level value must be an object");
  }
  if (typeof parsed.schemaVersion !== "number") {
    throw new Error("Invalid profile: missing numeric schemaVersion");
  }
  if (!isPlainObject(parsed.profile)) {
    throw new Error("Invalid profile: missing 'profile' object");
  }
  if (!isPlainObject(parsed.profile.metadata)) {
    throw new Error("Invalid profile: missing profile.metadata");
  }
  await writeEnvelope({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: parsed.profile as unknown as Profile,
  });
}
