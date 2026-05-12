import type { FieldDef } from "./greenhouseFields";
import { pickResumeFile } from "./greenhouseFields";

function yesNo(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "Yes" : "No";
}

export const workdayFields: Record<string, FieldDef> = {
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
  street: {
    kind: "input",
    selectors: [
      'input[data-automation-id="addressSection_addressLine1"]',
      'input[data-automation-id="addressLine1"]',
    ],
    labelPatterns: [/^address line 1\*?$/i, /^street\*?$/i, /^address\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.street,
  },
  city: {
    kind: "input",
    selectors: [
      'input[data-automation-id="addressSection_city"]',
      'input[data-automation-id="city"]',
    ],
    labelPatterns: [/^city\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.city,
  },
  state: {
    kind: "input",
    selectors: [
      'input[data-automation-id="addressSection_countryRegion"]',
      'input[data-automation-id="state"]',
    ],
    labelPatterns: [
      /^state\*?$/i,
      /^region\*?$/i,
      /^state\/province\*?$/i,
      /^county\*?$/i,
    ],
    getValue: (p) => p.identity?.contact?.address?.state,
  },
  zip: {
    kind: "input",
    selectors: [
      'input[data-automation-id="addressSection_postalCode"]',
      'input[data-automation-id="postalCode"]',
    ],
    labelPatterns: [/^postal code\*?$/i, /^zip code\*?$/i, /^zip\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.zip,
  },
  country: {
    kind: "select",
    labelPatterns: [/^country\*?$/i, /^country\/region\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.country,
  },
  workAuthUS: {
    kind: "select",
    labelPatterns: [
      /legally authorized to work in (the )?united states/i,
      /authorized to work in (the )?u\.?s\.?\b/i,
    ],
    getValue: (p) => yesNo(p.identity?.workAuth?.authorizedToWorkInUS),
  },
  sponsorship: {
    kind: "select",
    labelPatterns: [/require.*sponsorship/i, /need.*sponsorship/i],
    getValue: (p) => yesNo(p.identity?.workAuth?.requiresSponsorship),
  },
  citizenship: {
    kind: "select",
    labelPatterns: [/citizenship status/i, /^citizenship$/i],
    getValue: (p) => p.identity?.workAuth?.citizenshipStatus,
  },
  gender: {
    kind: "select",
    labelPatterns: [/^gender\*?$/i, /gender identity/i],
    getValue: (p) => p.identity?.demographics?.gender,
  },
  veteranStatus: {
    kind: "select",
    labelPatterns: [
      /veteran status/i,
      /^veteran\*?$/i,
      /protected veteran/i,
    ],
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
      'input[data-automation-id="file-upload-input-ref"]',
      'input[type="file"][data-automation-id*="resume"]',
      'input[type="file"][data-automation-id*="attachment"]',
    ],
    labelPatterns: [/^resume\*?$/i, /^cv\*?$/i, /^resume\/cv\*?$/i],
    getFile: (p) => pickResumeFile(p),
  },
};
