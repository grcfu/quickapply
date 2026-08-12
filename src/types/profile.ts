export type LegalName = {
  first?: string;
  middle?: string;
  last?: string;
  preferred?: string;
};

export type Address = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  /* Separate from `state`: US Workday tenants require both. */
  county?: string;
};

export type Contact = {
  email?: string;
  phone?: string;
  /* Workday's "Phone Device Type" — "Mobile", "Home", "Work". */
  phoneType?: string;
  address?: Address;
};

export type Demographics = {
  gender?: string;
  pronouns?: string;
  raceEthnicity?: string[];
  disabilityStatus?: string;
  veteranStatus?: string;
};

export type WorkAuth = {
  citizenshipStatus?: string;
  requiresSponsorship?: boolean;
  authorizedToWorkInUS?: boolean;
};

export type Education = {
  school?: string;
  degree?: string;
  fieldOfStudy?: string;
  gpa?: string;
  graduationDate?: string;
};

export type Certification = {
  name?: string;
  issuer?: string;
  /** Free-form; "2025-06" and "2025-06-15" both parse. */
  issuedDate?: string;
  expirationDate?: string;
  credentialId?: string;
  /** Scan of the certificate, for ATS sections that accept an upload. */
  attachment?: OriginalFile;
};

/**
 * An honour, award, scholarship, or recognition.
 *
 * Distinct from `Certification`: a certification has an issuing body, a
 * credential id and an expiry, and ATSs give it its own section (Workday does).
 * An award has none of those — TikTok asks only for Title, Year and Description.
 *
 * `date` is free-form on purpose: the source is often "Class of 2028" or
 * "Summer 2024" rather than a date. `parseMonthYear` pulls the year out for
 * forms that want a bare YYYY, and yields nothing for "All Semesters" — which
 * correctly leaves the field blank instead of inventing a year.
 */
export type Award = {
  title?: string;
  /** Who granted it. Folded into the description on forms with no issuer field. */
  issuer?: string;
  date?: string;
  description?: string;
};

export type Links = {
  linkedin?: string;
  github?: string;
  portfolio?: string;
};

export type EEOAnswers = Record<string, string | string[] | undefined>;

export type Identity = {
  legalName?: LegalName;
  contact?: Contact;
  links?: Links;
  demographics?: Demographics;
  workAuth?: WorkAuth;
  educations?: Education[];
  experiences?: Experience[];
  /*
   * Projects previously existed only under `resumes[].parsedData.projects`,
   * which meant a profile with no uploaded resume had nowhere to put them.
   * `pickProjects` prefers this list and falls back to the parsed one.
   */
  projects?: Project[];
  certifications?: Certification[];
  awards?: Award[];
  /**
   * Answer to "How did you hear about us?" — a per-applicant preference, not a
   * fact about the job. Left unset, the Workday field falls back to the
   * company's own careers site, which is where an extension-driven application
   * is being filled from anyway.
   */
  howDidYouHear?: string;
  eeo?: EEOAnswers;
};

export type Experience = {
  company?: string;
  title?: string;
  /** City/state of the role — Workday asks for this per entry. */
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

/**
 * Shaped to mirror `Experience`, because ATS project sections ask for the same
 * things a job does: what it was, your part in it, when, and a description.
 * TikTok's `project[N]` wants exactly name / role / link / desc.
 *
 * `tech` has no field on any ATS seen so far. It's kept structured rather than
 * pre-baked into `description` so a form that *does* have a stack field can use
 * it, and folded into the description on forms that don't — the same treatment
 * `Award.issuer` gets.
 */
export type Project = {
  name?: string;
  /** Your role on the project — TikTok labels this field "Title". */
  role?: string;
  description?: string;
  url?: string;
  tech?: string[];
  startDate?: string;
  endDate?: string;
};

export type ParsedResumeData = {
  school?: string;
  gpa?: string;
  graduationDate?: string;
  experiences?: Experience[];
  projects?: Project[];
  skills?: string[];
};

export type OriginalFile = {
  filename: string;
  contentBase64: string;
  mimeType?: string;
};

export type ResumeProfile = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  parsedData?: ParsedResumeData;
  originalFile?: OriginalFile;
};

export type AnswerEntry = {
  id: string;
  question: string;
  answer: string;
  companyName?: string;
  tags?: string[];
  createdAt: number;
  embedding?: number[];
};

export type LLMProvider = "anthropic" | "openai" | "gemini" | "none";

export type Settings = {
  defaultResumeId?: string;
  llmProvider?: LLMProvider;
  llmApiKey?: string;
  tonePreference?: string;
};

export type ProfileMetadata = {
  createdAt: number;
  lastUpdatedAt: number;
  version: number;
};

export type Profile = {
  identity?: Identity;
  resumes?: ResumeProfile[];
  answers?: AnswerEntry[];
  /**
   * Explicit skill list, used for ATSs that ask for skills one at a time
   * (Workday). Additive and optional, so profiles written before this existed
   * still read back fine — no schema bump needed. When absent, `pickSkills`
   * falls back to the default resume's parsed skills.
   */
  skills?: string[];
  settings?: Settings;
  metadata: ProfileMetadata;
};

export type DeepPartial<T> = T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
