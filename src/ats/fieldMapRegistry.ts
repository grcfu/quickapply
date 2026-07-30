import { greenhouseFieldMap } from "./greenhouseFields";
import { leverFields } from "./leverFields";
import { workdayFields } from "./workdayFields";
import type { FieldDef } from "./types";

export type FieldMap = Record<string, FieldDef>;

type Adapter = {
  hostSuffix: string;
  label: string;
  fieldMap: FieldMap;
};

/*
 * Workday tenants live on both myworkdayjobs.com (wd1/wd3/wd5 subdomains) and
 * myworkdaysite.com, which newer external career sites use.
 */
const adapters: Adapter[] = [
  { hostSuffix: "greenhouse.io", label: "Greenhouse", fieldMap: greenhouseFieldMap },
  { hostSuffix: "lever.co", label: "Lever", fieldMap: leverFields },
  { hostSuffix: "myworkdayjobs.com", label: "Workday", fieldMap: workdayFields },
  { hostSuffix: "myworkdaysite.com", label: "Workday", fieldMap: workdayFields },
];

function matches(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/** Distinct ATS names we can actually fill, for user-facing copy. */
export const SUPPORTED_ATS_LABELS: string[] = [
  ...new Set(adapters.map((a) => a.label)),
];

/** Human name of the ATS backing this host, or null if unsupported. */
export function getAtsLabel(hostname: string): string | null {
  for (const a of adapters) {
    if (matches(hostname, a.hostSuffix)) return a.label;
  }
  return null;
}

/**
 * The single source of truth for "can we fill this page?". The popup derives its
 * host gate from this instead of keeping a parallel list — that duplication is
 * what let the button claim Ashby was supported when no adapter existed.
 */
export const SUPPORTED_HOST_SUFFIXES: string[] = adapters.map(
  (a) => a.hostSuffix,
);

export function isSupportedHost(hostname: string): boolean {
  return SUPPORTED_HOST_SUFFIXES.some((suffix) => matches(hostname, suffix));
}

export function getFieldMapForHost(hostname: string): FieldMap | null {
  for (const a of adapters) {
    if (matches(hostname, a.hostSuffix)) return a.fieldMap;
  }
  return null;
}
