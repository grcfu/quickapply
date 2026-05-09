import type { Profile } from "../types/profile";

export type InputFieldDef = {
  kind: "input";
  selectors: string[];
  labelPatterns?: RegExp[];
  getValue: (profile: Profile) => string | undefined;
};

export type SelectFieldDef = {
  kind: "select";
  labelPatterns: RegExp[];
  getValue: (profile: Profile) => string | undefined;
};

export type GreenhouseFieldDef = InputFieldDef | SelectFieldDef;

function yesNo(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "Yes" : "No";
}

export const greenhouseFieldMap: Record<string, GreenhouseFieldDef> = {
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
};
