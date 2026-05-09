import type { Profile } from "../types/profile";

export type FieldDefinition = {
  selectors: string[];
  labelPatterns?: RegExp[];
  getValue: (profile: Profile) => string | undefined;
};

export const greenhouseFieldMap: Record<string, FieldDefinition> = {
  firstName: {
    selectors: [
      'input[name="job_application[first_name]"]',
      'input[id="first_name"]',
      'input[autocomplete="given-name"]',
    ],
    labelPatterns: [/^first name\*?$/i],
    getValue: (p) => p.identity?.legalName?.first,
  },
  lastName: {
    selectors: [
      'input[name="job_application[last_name]"]',
      'input[id="last_name"]',
      'input[autocomplete="family-name"]',
    ],
    labelPatterns: [/^last name\*?$/i],
    getValue: (p) => p.identity?.legalName?.last,
  },
  email: {
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
    selectors: [
      'input[name="job_application[phone]"]',
      'input[id="phone"]',
      'input[type="tel"]',
      'input[autocomplete="tel"]',
    ],
    labelPatterns: [/^phone( number)?\*?$/i],
    getValue: (p) => p.identity?.contact?.phone,
  },
};
