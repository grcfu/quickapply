import { pickResumeFile } from "./profileHelpers";
import type { FieldDef } from "./types";

function yesNo(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "Yes" : "No";
}

export const greenhouseFieldMap: Record<string, FieldDef> = {
  firstName: {
    kind: "input",
    selectors: [
      'input[name="job_application[first_name]"]',
      'input[id="first_name"]',
      'input[autocomplete="given-name"]',
    ],
    labelPatterns: [/^first name\*?$/i],
    getValue: (p) => p.identity?.legalName?.first,
  },
  lastName: {
    kind: "input",
    selectors: [
      'input[name="job_application[last_name]"]',
      'input[id="last_name"]',
      'input[autocomplete="family-name"]',
    ],
    labelPatterns: [/^last name\*?$/i],
    getValue: (p) => p.identity?.legalName?.last,
  },
  email: {
    kind: "input",
    selectors: [
      'input[name="job_application[email]"]',
      'input[id="email"]',
      'input[type="email"]',
      'input[autocomplete="email"]',
    ],
    labelPatterns: [/^email( address)?\*?$/i],
    getValue: (p) => p.identity?.contact?.email,
  },
  phone: {
    kind: "input",
    selectors: [
      'input[name="job_application[phone]"]',
      'input[id="phone"]',
      'input[type="tel"]',
      'input[autocomplete="tel"]',
    ],
    labelPatterns: [/^phone( number)?\*?$/i],
    getValue: (p) => p.identity?.contact?.phone,
  },
  workAuthUS: {
    kind: "select",
    labelPatterns: [
      /legally authorized to work in (the )?united states/i,
      /authorized to work in (the )?u\.?s\.?\b/i,
      /eligible to work in (the )?u\.?s\.?\b/i,
    ],
    getValue: (p) => yesNo(p.identity?.workAuth?.authorizedToWorkInUS),
  },
  sponsorship: {
    kind: "select",
    labelPatterns: [
      /require.*sponsorship/i,
      /need.*sponsorship/i,
      /sponsorship.*employment/i,
    ],
    getValue: (p) => yesNo(p.identity?.workAuth?.requiresSponsorship),
  },
  citizenship: {
    kind: "select",
    labelPatterns: [
      /citizenship status/i,
      /^citizenship$/i,
      /work authorization status/i,
    ],
    getValue: (p) => p.identity?.workAuth?.citizenshipStatus,
  },
  school: {
    kind: "input",
    selectors: [
      'input[name="job_application[school]"]',
      'input[id="school"]',
    ],
    labelPatterns: [
      /^school\*?$/i,
      /^university\*?$/i,
      /^college\*?$/i,
      /^school name\*?$/i,
    ],
    getValue: (p) => p.identity?.education?.school,
  },
  gpa: {
    kind: "input",
    selectors: [
      'input[name="job_application[gpa]"]',
      'input[id="gpa"]',
    ],
    labelPatterns: [/^gpa\*?$/i, /grade point average/i],
    getValue: (p) => p.identity?.education?.gpa,
  },
  graduationDate: {
    kind: "input",
    selectors: [
      'input[name="job_application[graduation_date]"]',
      'input[id="graduation_date"]',
    ],
    labelPatterns: [
      /graduation date/i,
      /expected graduation/i,
      /^graduation\*?$/i,
    ],
    getValue: (p) => p.identity?.education?.graduationDate,
  },
  degree: {
    kind: "input",
    selectors: ['input[id*="degree"]', 'input[name*="degree"]'],
    labelPatterns: [/^degree\*?$/i, /degree earned/i, /highest degree/i],
    getValue: (p) => p.identity?.education?.degree,
  },
  fieldOfStudy: {
    kind: "input",
    selectors: [
      'input[id*="field_of_study"]',
      'input[id*="major"]',
      'input[name*="field_of_study"]',
    ],
    labelPatterns: [/field of study/i, /^major\*?$/i, /^discipline\*?$/i],
    getValue: (p) => p.identity?.education?.fieldOfStudy,
  },
  linkedinUrl: {
    kind: "input",
    selectors: ['input[id*="linkedin"]', 'input[name*="linkedin"]'],
    labelPatterns: [/linkedin( url| profile)?/i],
    getValue: (p) => p.identity?.links?.linkedin,
  },
  githubUrl: {
    kind: "input",
    selectors: ['input[id*="github"]', 'input[name*="github"]'],
    labelPatterns: [/github( url| profile)?/i],
    getValue: (p) => p.identity?.links?.github,
  },
  portfolioUrl: {
    kind: "input",
    selectors: [
      'input[id*="portfolio"]',
      'input[id*="website"]',
      'input[name*="portfolio"]',
      'input[name*="website"]',
    ],
    labelPatterns: [
      /^portfolio( url)?\*?$/i,
      /personal website/i,
      /^website( url)?\*?$/i,
    ],
    getValue: (p) => p.identity?.links?.portfolio,
  },
  street: {
    kind: "input",
    selectors: [
      'input[name="job_application[street]"]',
      'input[id="street"]',
      'input[autocomplete="street-address"]',
      'input[autocomplete="address-line1"]',
    ],
    labelPatterns: [/^street( address)?\*?$/i, /^address( line 1)?\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.street,
  },
  city: {
    kind: "input",
    selectors: [
      'input[name="job_application[city]"]',
      'input[id="city"]',
      'input[autocomplete="address-level2"]',
    ],
    labelPatterns: [/^city\*?$/i, /^city\/town\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.city,
  },
  state: {
    kind: "input",
    selectors: [
      'input[name="job_application[region]"]',
      'input[name="job_application[state]"]',
      'input[id="state"]',
      'input[autocomplete="address-level1"]',
    ],
    labelPatterns: [/^state\*?$/i, /^state\/province\*?$/i, /^region\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.state,
  },
  zip: {
    kind: "input",
    selectors: [
      'input[name="job_application[zip]"]',
      'input[name="job_application[postal_code]"]',
      'input[id="zip"]',
      'input[autocomplete="postal-code"]',
    ],
    labelPatterns: [/^zip( code)?\*?$/i, /^postal code\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.zip,
  },
  country: {
    kind: "select",
    labelPatterns: [/^country\*?$/i, /^country\/region\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.country,
  },
  gender: {
    kind: "select",
    labelPatterns: [/^gender\*?$/i, /gender identity/i],
    getValue: (p) => p.identity?.demographics?.gender,
  },
  pronouns: {
    kind: "input",
    selectors: [
      'input[name="job_application[pronouns]"]',
      'input[id="pronouns"]',
    ],
    labelPatterns: [/^pronouns\*?$/i, /preferred pronouns/i],
    getValue: (p) => p.identity?.demographics?.pronouns,
  },
  veteranStatus: {
    kind: "select",
    labelPatterns: [/veteran status/i, /^veteran\*?$/i, /protected veteran/i],
    getValue: (p) => p.identity?.demographics?.veteranStatus,
  },
  disabilityStatus: {
    kind: "select",
    labelPatterns: [/disability status/i, /^disability\*?$/i],
    getValue: (p) => p.identity?.demographics?.disabilityStatus,
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
      'input[type="file"][name="job_application[resume]"]',
      'input[type="file"][id="resume"]',
      'input[type="file"][name*="resume"]',
    ],
    labelPatterns: [/^resume\*?$/i, /^resume\/cv\*?$/i, /^cv\*?$/i],
    getFile: (p) => pickResumeFile(p),
  },
};
