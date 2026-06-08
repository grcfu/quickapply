import type { Profile } from "./types/profile";

export type CompletenessBucket = {
  key: string;
  label: string;
  filled: boolean;
};

export type CompletenessResult = {
  percent: number;
  filled: number;
  total: number;
  buckets: CompletenessBucket[];
};

export function computeCompleteness(
  profile: Profile | null,
): CompletenessResult {
  const identity = profile?.identity ?? {};
  const buckets: CompletenessBucket[] = [
    {
      key: "name",
      label: "Name",
      filled: Boolean(identity.legalName?.first && identity.legalName?.last),
    },
    {
      key: "email",
      label: "Email",
      filled: Boolean(identity.contact?.email),
    },
    {
      key: "phone",
      label: "Phone",
      filled: Boolean(identity.contact?.phone),
    },
    {
      key: "address",
      label: "Address",
      filled: Boolean(
        identity.contact?.address?.city && identity.contact?.address?.state,
      ),
    },
    {
      key: "workAuth",
      label: "Work authorization",
      filled: Boolean(
        identity.workAuth?.citizenshipStatus !== undefined ||
          identity.workAuth?.authorizedToWorkInUS !== undefined,
      ),
    },
    {
      key: "links",
      label: "LinkedIn / GitHub / portfolio",
      filled: Boolean(
        identity.links?.linkedin ||
          identity.links?.github ||
          identity.links?.portfolio,
      ),
    },
    {
      key: "education",
      label: "Education",
      filled: Boolean(identity.educations?.[0]?.school),
    },
    {
      key: "demographics",
      label: "Demographics",
      filled: Boolean(
        identity.demographics?.gender ||
          identity.demographics?.pronouns ||
          identity.demographics?.veteranStatus ||
          identity.demographics?.disabilityStatus,
      ),
    },
    {
      key: "resume",
      label: "Resume",
      filled: (profile?.resumes?.length ?? 0) > 0,
    },
    {
      key: "answers",
      label: "Saved answers",
      filled: (profile?.answers?.length ?? 0) > 0,
    },
  ];
  const filled = buckets.filter((b) => b.filled).length;
  const total = buckets.length;
  return {
    percent: total === 0 ? 0 : Math.round((filled / total) * 100),
    filled,
    total,
    buckets,
  };
}
