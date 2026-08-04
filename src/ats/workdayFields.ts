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
      '[data-automation-id="add-button"]',
      '[data-automation-id="Add"]',
      '[data-automation-id="addButton"]',
    ],
    addButtonLabelPatterns: [/^add$/i, /^add another$/i, /^add education$/i],
    panelSelectors: [
      '[data-automation-id="panelSet-Item"]',
      '[data-automation-id="educationEntry"]',
    ],
    getEntries: (p) => p.identity?.educations,
    subFields: {
      /*
       * "School or University" reads "0 items selected" — it's a multiselect
       * typeahead, not a text field. The page even says so: "type a few letters
       * and press ENTER". Writing text into it leaves the entry empty.
       */
      school: {
        kind: "typeahead",
        selectors: [
          '[data-automation-id="formField-school"]',
          '[data-automation-id="formField-schoolName"]',
        ],
        labelPatterns: [/^school( or university)?\*?$/i, /^university\*?$/i],
        getValue: (e) => e.school,
      },
      degree: {
        kind: "dropdown",
        selectors: [
          '[data-automation-id="formField-degree"]',
          '[data-automation-id="degree"]',
        ],
        labelPatterns: [/^degree\*?$/i],
        getValue: (e) => e.degree,
      },
      fieldOfStudy: {
        kind: "typeahead",
        selectors: [
          '[data-automation-id="formField-field-of-study"]',
          '[data-automation-id="formField-fieldOfStudy"]',
        ],
        labelPatterns: [/^field of study\*?$/i, /^major\*?$/i],
        getValue: (e) => e.fieldOfStudy,
      },
      gpa: {
        kind: "input",
        selectors: [
          '[data-automation-id="formField-gradeAverage"]',
          '[data-automation-id="formField-gpa"]',
        ],
        labelPatterns: [/^gpa\*?$/i, /overall result/i, /grade average/i],
        getValue: (e) => e.gpa,
      },
      graduationDate: {
        kind: "month-year",
        selectors: [
          '[data-automation-id="formField-lastYearAttended"]',
          '[data-automation-id="formField-endDate"]',
          '[data-automation-id="lastYearAttended"]',
        ],
        labelPatterns: [/last year attended/i, /graduation/i],
        getValue: (e) => e.graduationDate,
      },
    },
  },

  experience: {
    kind: "experience-group",
    page: "myExperience",
    containerSelectors: [
      '[data-automation-id="workExperienceSection"]',
      '[data-automation-id="work-experience-section"]',
    ],
    containerHeadingPatterns: [/^work experience$/i, /^experience$/i],
    addButtonSelectors: [
      '[data-automation-id="add-button"]',
      '[data-automation-id="Add"]',
      '[data-automation-id="addButton"]',
    ],
    addButtonLabelPatterns: [
      /^add$/i,
      /^add another$/i,
      /^add work experience$/i,
    ],
    panelSelectors: [
      '[data-automation-id="panelSet-Item"]',
      '[data-automation-id="workExperienceEntry"]',
    ],
    getEntries: (p) => p.identity?.experiences,
    subFields: {
      jobTitle: {
        kind: "input",
        selectors: [
          '[data-automation-id="formField-jobTitle"]',
          'input[data-automation-id="jobTitle"]',
        ],
        labelPatterns: [/^job title\*?$/i, /^title\*?$/i, /^position\*?$/i],
        getValue: (e) => e.title,
      },
      company: {
        kind: "input",
        selectors: [
          '[data-automation-id="formField-companyName"]',
          '[data-automation-id="formField-company"]',
        ],
        labelPatterns: [/^company\*?$/i, /^employer\*?$/i],
        getValue: (e) => e.company,
      },
      location: {
        kind: "input",
        selectors: [
          '[data-automation-id="formField-location"]',
          '[data-automation-id="formField-jobLocation"]',
        ],
        labelPatterns: [/^location\*?$/i, /^city\*?$/i],
        getValue: (e) => e.location,
      },
      /*
       * "To" is required unless this is ticked, so an ongoing role (no endDate)
       * fails validation without it.
       */
      currentlyWorkHere: {
        kind: "checkbox",
        selectors: [
          '[data-automation-id="formField-currentlyWorkHere"]',
          '[data-automation-id="currentlyWorkHere"]',
        ],
        labelPatterns: [/^i currently work here$/i],
        getValue: (e) => (e.endDate?.trim() ? undefined : "yes"),
      },
      description: {
        kind: "input",
        selectors: [
          '[data-automation-id="formField-roleDescription"]',
          '[data-automation-id="formField-description"]',
        ],
        labelPatterns: [/^role description\*?$/i, /^description\*?$/i],
        getValue: (e) => e.description,
      },
      startDate: {
        kind: "month-year",
        selectors: [
          '[data-automation-id="formField-startDate"]',
          '[data-automation-id="startDate"]',
        ],
        labelPatterns: [/^from\*?$/i, /start date/i],
        getValue: (e) => e.startDate,
      },
      endDate: {
        kind: "month-year",
        selectors: [
          '[data-automation-id="formField-endDate"]',
          '[data-automation-id="endDate"]',
        ],
        labelPatterns: [/^to\*?$/i, /end date/i],
        getValue: (e) => e.endDate,
      },
    },
  },

  certifications: {
    kind: "certification-group",
    page: "myExperience",
    containerSelectors: [
      '[data-automation-id="certificationSection"]',
      '[data-automation-id="certificationsSection"]',
    ],
    containerHeadingPatterns: [
      /^certifications? and licenses?$/i,
      /^certifications?$/i,
    ],
    addButtonSelectors: [
      '[data-automation-id="add-button"]',
      '[data-automation-id="Add"]',
      '[data-automation-id="addButton"]',
    ],
    addButtonLabelPatterns: [/^add$/i, /^add another$/i],
    panelSelectors: [
      '[data-automation-id="panelSet-Item"]',
      '[data-automation-id="certificationEntry"]',
    ],
    getEntries: (p) => p.identity?.certifications,
    subFields: {
      /* "0 items selected" — a multiselect prompt, same as School. */
      name: {
        kind: "typeahead",
        selectors: [
          '[data-automation-id="formField-certification"]',
          '[data-automation-id="formField-certificationName"]',
        ],
        labelPatterns: [/^certification\*?$/i, /^certification name\*?$/i],
        getValue: (c) => c.name,
      },
      number: {
        kind: "input",
        selectors: [
          '[data-automation-id="formField-certificationNumber"]',
          '[data-automation-id="formField-number"]',
        ],
        labelPatterns: [/^certification number\*?$/i, /^number\*?$/i],
        getValue: (c) => c.credentialId,
      },
      /* MM/DD/YYYY here, unlike the MM/YYYY used elsewhere on the form. */
      issuedDate: {
        kind: "month-year",
        selectors: [
          '[data-automation-id="formField-issuedDate"]',
          '[data-automation-id="formField-issued"]',
        ],
        labelPatterns: [/^issued date\*?$/i, /^issued\*?$/i],
        getValue: (c) => c.issuedDate,
      },
      expirationDate: {
        kind: "month-year",
        selectors: [
          '[data-automation-id="formField-expirationDate"]',
          '[data-automation-id="formField-expiration"]',
        ],
        labelPatterns: [/^expiration date\*?$/i, /^expires\*?$/i],
        getValue: (c) => c.expirationDate,
      },
      attachment: {
        kind: "file",
        selectors: [
          '[data-automation-id="formField-attachments"]',
          '[data-automation-id="formField-attachment"]',
          'input[type="file"]',
        ],
        labelPatterns: [/^attachments?\*?$/i],
        getFile: (c) => c.attachment,
      },
    },
  },

  /*
   * Websites is an Add-button repeating section, not a set of fixed inputs — the
   * URL field doesn't exist in the DOM until a row is added, so the plain input
   * selectors this used to rely on could never match.
   *
   * LinkedIn is excluded on purpose: Workday gives it a dedicated field, handled
   * by linkedinUrl below.
   */
  websites: {
    kind: "website-group",
    page: "myExperience",
    containerSelectors: [
      '[data-automation-id="websiteSection"]',
      '[data-automation-id="websitePanelSet"]',
    ],
    containerHeadingPatterns: [/^websites?$/i, /^web addresses$/i],
    addButtonSelectors: [
      '[data-automation-id="add-button"]',
      '[data-automation-id="Add"]',
      '[data-automation-id="addButton"]',
    ],
    addButtonLabelPatterns: [/^add$/i, /^add another$/i, /^add website$/i],
    panelSelectors: [
      '[data-automation-id="panelSet-Item"]',
      '[data-automation-id="websiteEntry"]',
    ],
    getEntries: (p) => {
      const links = p.identity?.links;
      return [links?.github, links?.portfolio]
        .filter((url): url is string => Boolean(url?.trim()))
        .map((url) => ({ url }));
    },
    subFields: {
      url: {
        kind: "input",
        selectors: [
          '[data-automation-id="formField-website"]',
          '[data-automation-id="formField-url"]',
          'input[data-automation-id="website"]',
        ],
        labelPatterns: [/^url\*?$/i, /^website\*?$/i, /^web address\*?$/i],
        getValue: (e) => e.url,
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
  /*
   * GitHub and portfolio normally go through the `websites` group above. These
   * remain only for tenants that expose a dedicated named field instead.
   *
   * The generic `*website*` selector was deliberately dropped: it matched the
   * URL input inside the Websites panel, so it overwrote row 1 right after the
   * group had filled it.
   */
  githubUrl: {
    kind: "input",
    page: "myExperience",
    selectors: ['input[data-automation-id*="github" i]'],
    labelPatterns: [/^github( url| profile)?\*?$/i],
    getValue: (p) => p.identity?.links?.github,
  },
  portfolioUrl: {
    kind: "input",
    page: "myExperience",
    selectors: ['input[data-automation-id*="portfolio" i]'],
    labelPatterns: [/^portfolio( url)?\*?$/i, /^personal website\*?$/i],
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
