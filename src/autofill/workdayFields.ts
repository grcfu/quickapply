import type { GreenhouseFieldDef } from "./greenhouseFields";

export const workdayFields: Record<string, GreenhouseFieldDef> = {
  firstName: {
    kind: "input",
    selectors: [
      'input[data-automation-id="legalNameSection_firstName"]',
      'input[data-automation-id="firstName"]',
      'input[data-automation-id="legal-name-first-name"]',
    ],
    labelPatterns: [/^first name\*?$/i, /^given name\*?$/i],
    getValue: (p) => p.identity?.legalName?.first,
  },
  lastName: {
    kind: "input",
    selectors: [
      'input[data-automation-id="legalNameSection_lastName"]',
      'input[data-automation-id="lastName"]',
      'input[data-automation-id="legal-name-last-name"]',
    ],
    labelPatterns: [/^last name\*?$/i, /^family name\*?$/i, /^surname\*?$/i],
    getValue: (p) => p.identity?.legalName?.last,
  },
  email: {
    kind: "input",
    selectors: [
      'input[data-automation-id="email"]',
      'input[data-automation-id="emailAddress"]',
      'input[data-automation-id="contactInfo_emailAddress"]',
      'input[type="email"]',
    ],
    labelPatterns: [/^email( address)?\*?$/i],
    getValue: (p) => p.identity?.contact?.email,
  },
  phone: {
    kind: "input",
    selectors: [
      'input[data-automation-id="phone-number"]',
      'input[data-automation-id="phoneNumber"]',
      'input[data-automation-id="contactInfo_phoneNumber"]',
      'input[type="tel"]',
    ],
    labelPatterns: [/^phone( number)?\*?$/i, /^mobile( number)?\*?$/i],
    getValue: (p) => p.identity?.contact?.phone,
  },
};
