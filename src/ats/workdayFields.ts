import { pickResumeFile, pickSkills, yesNo } from "./profileHelpers";
import type { FieldDef } from "./types";

/**
 * Workday's apply flow is a wizard — see workdayPages.ts. Each field carries the
 * step it lives on so a miss on another step reads as "on My Experience" rather
 * than a bogus "field not found".
 *
 * Selectors lead with `data-automation-id`, Workday's stable hook, and fall back
 * to label patterns. The label fallback only works at all because labels.ts
 * resolves `aria-labelledby` — Workday rarely emits `<label for>`.
 */
export const workdayFields: Record<string, FieldDef> = {
  firstName: {
    kind: "input",
    page: "myInformation",
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
    page: "myInformation",
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
    page: "myInformation",
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
    page: "myInformation",
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
    page: "myInformation",
    selectors: [
      'input[data-automation-id="addressSection_addressLine1"]',
      'input[data-automation-id="addressLine1"]',
    ],
    labelPatterns: [/^address line 1\*?$/i, /^street\*?$/i, /^address\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.street,
  },
  city: {
    kind: "input",
    page: "myInformation",
    selectors: [
      'input[data-automation-id="addressSection_city"]',
      'input[data-automation-id="city"]',
    ],
    labelPatterns: [/^city\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.city,
  },
  /*
   * State/Region is a dropdown button on Workday, not a text input. This was
   * declared `kind: "input"`, so its selector could never match and the field
   * silently never filled.
   */
  state: {
    kind: "select",
    page: "myInformation",
    selectors: [
      '[data-automation-id="addressSection_countryRegion"]',
      '[data-automation-id="countryRegion"]',
      '[data-automation-id="addressSection_region"]',
    ],
    labelPatterns: [
      /^state\*?$/i,
      /^region\*?$/i,
      /^state\/province\*?$/i,
      /^state or province\*?$/i,
      /^county\*?$/i,
    ],
    getValue: (p) => p.identity?.contact?.address?.state,
  },
  zip: {
    kind: "input",
    page: "myInformation",
    selectors: [
      'input[data-automation-id="addressSection_postalCode"]',
      'input[data-automation-id="postalCode"]',
    ],
    labelPatterns: [/^postal code\*?$/i, /^zip code\*?$/i, /^zip\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.zip,
  },
  country: {
    kind: "select",
    page: "myInformation",
    selectors: [
      '[data-automation-id="countryDropdown"]',
      '[data-automation-id="addressSection_country"]',
      '[data-automation-id="country"]',
    ],
    labelPatterns: [/^country\*?$/i, /^country\/region\*?$/i],
    getValue: (p) => p.identity?.contact?.address?.country,
  },

  education: {
    kind: "education-group",
    page: "myExperience",
    containerSelectors: [
      '[data-automation-id="educationSection"]',
      '[data-automation-id="education-section"]',
    ],
    containerHeadingPatterns: [/^education$/i],
    addButtonSelectors: [
      '[data-automation-id="Add"]',
      'button[data-automation-id="add-button"]',
      '[data-automation-id="addButton"]',
    ],
    addButtonLabelPatterns: [/^add$/i, /^add another$/i, /^add education$/i],
    panelSelectors: [
      '[data-automation-id="panelSet-Item"]',
      '[data-automation-id="educationEntry"]',
    ],
    getEntries: (p) => p.identity?.educations,
    subFields: {
      school: {
        kind: "input",
        selectors: [
          'input[data-automation-id="school"]',
          'input[data-automation-id="schoolName"]',
        ],
        labelPatterns: [/^school( name)?\*?$/i, /^university\*?$/i],
        getValue: (e) => e.school,
      },
      degree: {
        kind: "dropdown",
        selectors: ['[data-automation-id="degree"]'],
        labelPatterns: [/^degree\*?$/i],
        getValue: (e) => e.degree,
      },
      fieldOfStudy: {
        kind: "typeahead",
        selectors: [
          'input[data-automation-id="field-of-study"]',
          '[data-automation-id="formField-field-of-study"] input',
        ],
        labelPatterns: [/^field of study\*?$/i, /^major\*?$/i],
        getValue: (e) => e.fieldOfStudy,
      },
      gpa: {
        kind: "input",
        selectors: [
          'input[data-automation-id="gradeAverage"]',
          'input[data-automation-id="gpa"]',
        ],
        labelPatterns: [/^gpa\*?$/i, /overall result/i, /grade average/i],
        getValue: (e) => e.gpa,
      },
      graduationDate: {
        kind: "month-year",
        selectors: [
          '[data-automation-id="lastYearAttended"]',
          '[data-automation-id="endDate"]',
          '[data-automation-id="graduationDate"]',
        ],
        labelPatterns: [/last year attended/i, /graduation/i],
        getValue: (e) => e.graduationDate,
      },
    },
  },

  /*
   * Workday's Skills box only accepts values chosen from the prompt list it
   * opens as you type, one at a time — a comma-joined string leaves it empty on
   * submit.
   */
  skills: {
    kind: "multi-typeahead",
    page: "myExperience",
    selectors: [
      'input[data-automation-id="skillsSearchBox"]',
      '[data-automation-id="skillsSection"] input[type="text"]',
      '[data-automation-id="formField-skills"] input',
    ],
    labelPatterns: [/^skills\*?$/i, /^add skills/i],
    getValues: (p) => pickSkills(p),
  },

  workAuthUS: {
    kind: "select",
    page: "questions",
    labelPatterns: [
      /legally authorized to work in (the )?united states/i,
      /authorized to work in (the )?u\.?s\.?\b/i,
    ],
    getValue: (p) => yesNo(p.identity?.workAuth?.authorizedToWorkInUS),
  },
  sponsorship: {
    kind: "select",
    page: "questions",
    labelPatterns: [/require.*sponsorship/i, /need.*sponsorship/i],
    getValue: (p) => yesNo(p.identity?.workAuth?.requiresSponsorship),
  },
  citizenship: {
    kind: "select",
    page: "questions",
    labelPatterns: [/citizenship status/i, /^citizenship$/i],
    getValue: (p) => p.identity?.workAuth?.citizenshipStatus,
  },
  linkedinUrl: {
    kind: "input",
    page: "myExperience",
    selectors: [
      'input[data-automation-id="linkedinQuestion"]',
      'input[data-automation-id*="linkedIn" i]',
      'input[data-automation-id*="linkedin" i]',
    ],
    labelPatterns: [/linkedin( url| profile)?/i],
    getValue: (p) => p.identity?.links?.linkedin,
  },
  githubUrl: {
    kind: "input",
    page: "myExperience",
    selectors: ['input[data-automation-id*="github" i]'],
    labelPatterns: [/github( url| profile)?/i],
    getValue: (p) => p.identity?.links?.github,
  },
  portfolioUrl: {
    kind: "input",
    page: "myExperience",
    selectors: [
      'input[data-automation-id*="portfolio" i]',
      'input[data-automation-id*="website" i]',
    ],
    labelPatterns: [
      /^portfolio( url)?\*?$/i,
      /personal website/i,
      /^website( url)?\*?$/i,
    ],
    getValue: (p) => p.identity?.links?.portfolio,
  },
  gender: {
    kind: "select",
    page: "disclosures",
    labelPatterns: [/^gender\*?$/i, /gender identity/i],
    getValue: (p) => p.identity?.demographics?.gender,
  },
  veteranStatus: {
    kind: "select",
    page: "disclosures",
    labelPatterns: [/veteran status/i, /^veteran\*?$/i, /protected veteran/i],
    getValue: (p) => p.identity?.demographics?.veteranStatus,
  },
  disabilityStatus: {
    kind: "select",
    page: "selfIdentify",
    labelPatterns: [/disability status/i, /^disability\*?$/i],
    getValue: (p) => p.identity?.demographics?.disabilityStatus,
  },
  raceEthnicity: {
    kind: "multi-checkbox",
    page: "disclosures",
    labelPatterns: [/race\s*\/?\s*ethnicity/i, /^race\*?$/i, /^ethnicity\*?$/i],
    getValues: (p) => p.identity?.demographics?.raceEthnicity,
  },
  resume: {
    kind: "file",
    page: "myExperience",
    selectors: [
      'input[data-automation-id="file-upload-input-ref"]',
      'input[type="file"][data-automation-id*="resume"]',
      'input[type="file"][data-automation-id*="attachment"]',
    ],
    labelPatterns: [/^resume\*?$/i, /^cv\*?$/i, /^resume\/cv\*?$/i],
    getFile: (p) => pickResumeFile(p),
  },
};
