/**
 * Workday's "Apply" flow is not one form — it's a wizard of 4-6 separately
 * mounted steps (My Information, My Experience, Application Questions,
 * Voluntary Disclosures, Self Identify, Review). Only one step's fields exist
 * in the DOM at a time.
 *
 * A flat field map therefore reports every field belonging to another step as
 * "field not found", which buries the handful of genuine failures in noise.
 * Detecting the current step lets us label those misses honestly.
 *
 * Detection is deliberately advisory only: `runAutofill` still attempts every
 * field regardless of the answer here, and uses it purely to word the result.
 * That way a wrong or tenant-specific page tag can never suppress a fill that
 * would otherwise have worked.
 */

export type WorkdayPage =
  | "account"
  | "myInformation"
  | "myExperience"
  | "questions"
  | "disclosures"
  | "selfIdentify"
  | "review";

export const WORKDAY_PAGE_LABELS: Record<WorkdayPage, string> = {
  account: "Create Account",
  myInformation: "My Information",
  myExperience: "My Experience",
  questions: "Application Questions",
  disclosures: "Voluntary Disclosures",
  selfIdentify: "Self Identify",
  review: "Review",
};

/**
 * Structural markers beat text: they survive localisation and Workday's
 * per-tenant heading wording.
 */
const SECTION_MARKERS: { page: WorkdayPage; selectors: string[] }[] = [
  {
    page: "myExperience",
    selectors: [
      '[data-automation-id="educationSection"]',
      '[data-automation-id="workExperienceSection"]',
      '[data-automation-id="skillsSection"]',
    ],
  },
  {
    page: "myInformation",
    selectors: [
      '[data-automation-id="legalNameSection"]',
      '[data-automation-id="addressSection"]',
      '[data-automation-id="legalNameSection_firstName"]',
    ],
  },
  {
    page: "selfIdentify",
    selectors: [
      '[data-automation-id="selfIdentificationDisability"]',
      '[data-automation-id="disabilitySection"]',
    ],
  },
  {
    page: "account",
    selectors: [
      '[data-automation-id="createAccountSubmitButton"]',
      '[data-automation-id="verifyPassword"]',
    ],
  },
  {
    page: "review",
    selectors: ['[data-automation-id="reviewSection"]'],
  },
];

const HEADING_PATTERNS: { page: WorkdayPage; pattern: RegExp }[] = [
  { page: "myInformation", pattern: /^my information$/i },
  { page: "myExperience", pattern: /^my experience$/i },
  { page: "questions", pattern: /^application questions?$/i },
  { page: "disclosures", pattern: /^voluntary disclosures$/i },
  { page: "selfIdentify", pattern: /self.?identif/i },
  { page: "review", pattern: /^review$/i },
  { page: "account", pattern: /^(create account|sign in)$/i },
];

const URL_PATTERNS: { page: WorkdayPage; pattern: RegExp }[] = [
  { page: "account", pattern: /\/(login|register|createAccount)\b/i },
  { page: "myInformation", pattern: /applyManually|myInformation/i },
  { page: "myExperience", pattern: /myExperience/i },
  { page: "questions", pattern: /questionnaire|applicationQuestions/i },
  { page: "disclosures", pattern: /voluntaryDisclosures/i },
  { page: "selfIdentify", pattern: /selfIdentif/i },
  { page: "review", pattern: /\/review\b/i },
];

function fromMarkers(root: ParentNode): WorkdayPage | null {
  for (const { page, selectors } of SECTION_MARKERS) {
    if (selectors.some((s) => root.querySelector(s))) return page;
  }
  return null;
}

function fromActiveStep(root: ParentNode): WorkdayPage | null {
  const active = root.querySelector(
    '[data-automation-id="progressBarActiveStep"], [aria-current="step"]',
  );
  const text = (active?.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  for (const { page, pattern } of HEADING_PATTERNS) {
    if (pattern.test(text)) return page;
  }
  return null;
}

function fromHeadings(root: ParentNode): WorkdayPage | null {
  for (const h of Array.from(root.querySelectorAll("h1, h2, h3"))) {
    const text = (h.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 60) continue;
    for (const { page, pattern } of HEADING_PATTERNS) {
      if (pattern.test(text)) return page;
    }
  }
  return null;
}

function fromUrl(url: string): WorkdayPage | null {
  for (const { page, pattern } of URL_PATTERNS) {
    if (pattern.test(url)) return page;
  }
  return null;
}

/** Returns null when the step can't be determined — callers must tolerate that. */
export function detectWorkdayPage(
  root: ParentNode = document,
  url: string = window.location.href,
): WorkdayPage | null {
  return (
    fromMarkers(root) ??
    fromActiveStep(root) ??
    fromHeadings(root) ??
    fromUrl(url)
  );
}
