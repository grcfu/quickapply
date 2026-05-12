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
};

export type Contact = {
  email?: string;
  phone?: string;
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
  eeo?: EEOAnswers;
};

export type Experience = {
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

export type Project = {
  name?: string;
  description?: string;
  url?: string;
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
  settings?: Settings;
  metadata: ProfileMetadata;
};

export type DeepPartial<T> = T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
