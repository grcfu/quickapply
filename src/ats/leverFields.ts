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
  /*
   * Lever has no first-class education section — schools show up as custom
   * question cards whose `name` attributes are per-posting (`cards[uuid][field3]`),
   * so these match on label text only and read the first education entry.
   */
  school: {
    kind: "input",
    selectors: [],
    labelPatterns: [
      /^school( name)?\*?$/i,
      /^university\*?$/i,
      /^college\*?$/i,
    ],
    getValue: (p) => p.identity?.educations?.[0]?.school,
  },
  degree: {
    kind: "input",
    selectors: [],
    labelPatterns: [/^degree\*?$/i, /degree earned/i, /highest degree/i],
    getValue: (p) => p.identity?.educations?.[0]?.degree,
  },
  fieldOfStudy: {
    kind: "input",
    selectors: [],
    labelPatterns: [
      /^field of study\*?$/i,
      /^major\*?$/i,
      /^concentration\*?$/i,
    ],
    getValue: (p) => p.identity?.educations?.[0]?.fieldOfStudy,
  },
  gpa: {
    kind: "input",
    selectors: [],
    labelPatterns: [/^gpa\*?$/i, /grade point average/i],
    getValue: (p) => p.identity?.educations?.[0]?.gpa,
  },
  graduationDate: {
    kind: "input",
    selectors: [],
    labelPatterns: [
      /graduation date/i,
      /^graduation( year)?\*?$/i,
      /expected graduation/i,
    ],
    getValue: (p) => p.identity?.educations?.[0]?.graduationDate,
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
