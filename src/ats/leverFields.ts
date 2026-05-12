import { pickResumeFile } from "./profileHelpers";
import type { FieldDef } from "./types";

function fullName(
  first: string | undefined,
  last: string | undefined,
): string | undefined {
  const parts = [first, last].filter((s): s is string => Boolean(s?.trim()));
  if (parts.length === 0) return undefined;
  return parts.join(" ");
}

export const leverFields: Record<string, FieldDef> = {
  name: {
    kind: "input",
    selectors: [
      'input[name="name"]',
      'input[autocomplete="name"]',
    ],
    labelPatterns: [/^full name\*?$/i, /^name\*?$/i],
    getValue: (p) => fullName(p.identity?.legalName?.first, p.identity?.legalName?.last),
  },
  email: {
    kind: "input",
    selectors: [
      'input[name="email"]',
      'input[type="email"]',
      'input[autocomplete="email"]',
    ],
    labelPatterns: [/^email\*?$/i],
    getValue: (p) => p.identity?.contact?.email,
  },
  phone: {
    kind: "input",
    selectors: [
      'input[name="phone"]',
      'input[type="tel"]',
      'input[autocomplete="tel"]',
    ],
    labelPatterns: [/^phone\*?$/i],
    getValue: (p) => p.identity?.contact?.phone,
  },
  linkedinUrl: {
    kind: "input",
    selectors: [
      'input[name="urls[LinkedIn]"]',
      'input[name="urls[Linkedin]"]',
    ],
    labelPatterns: [/linkedin( url| profile)?/i],
    getValue: (p) => p.identity?.links?.linkedin,
  },
  githubUrl: {
    kind: "input",
    selectors: [
      'input[name="urls[GitHub]"]',
      'input[name="urls[Github]"]',
    ],
    labelPatterns: [/github( url| profile)?/i],
    getValue: (p) => p.identity?.links?.github,
  },
  portfolioUrl: {
    kind: "input",
    selectors: [
      'input[name="urls[Portfolio]"]',
      'input[name="urls[Other]"]',
      'input[name="urls[Website]"]',
    ],
    labelPatterns: [
      /^portfolio( url)?\*?$/i,
      /personal website/i,
      /^website( url)?\*?$/i,
      /^other website/i,
    ],
    getValue: (p) => p.identity?.links?.portfolio,
  },
  raceEthnicity: {
    kind: "multi-checkbox",
    labelPatterns: [
      /race\s*\/?\s*ethnicity/i,
      /^race\*?$/i,
      /^ethnicity\*?$/i,
    ],
    getValues: (p) => p.identity?.demographics?.raceEthnicity,
  },
  resume: {
    kind: "file",
    selectors: [
      'input[type="file"][name="resume"]',
      'input[type="file"][id="resume-upload-input"]',
    ],
    labelPatterns: [/^resume\*?$/i, /^resume\/cv\*?$/i],
    getFile: (p) => pickResumeFile(p),
  },
};
