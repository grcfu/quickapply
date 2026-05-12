import type { OriginalFile, Profile } from "../types/profile";

export function pickResumeFile(profile: Profile): OriginalFile | undefined {
  const resumes = profile.resumes ?? [];
  if (resumes.length === 0) return undefined;
  const defaultId = profile.settings?.defaultResumeId;
  if (defaultId) {
    const found = resumes.find((r) => r.id === defaultId);
    if (found?.originalFile) return found.originalFile;
  }
  return resumes[0]?.originalFile;
}
