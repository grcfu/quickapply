import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  addResume,
  clearOnboardingDraft,
  getProfile,
  loadOnboardingDraft,
  saveOnboardingDraft,
  updateProfile,
} from "../storage/profileStorage";
import { extractTextFromPdf } from "../resume/extractText";
import { extractFields } from "../resume/extractFields";
import type { ExtractedFields } from "../resume/extractFields";
import { fileToBase64 } from "../resume/fileUtils";
import type { Education, Experience } from "../types/profile";

type YesNo = "" | "yes" | "no";

const RACE_OPTIONS = [
  "Hispanic or Latino",
  "White",
  "Black or African American",
  "Asian",
  "Native Hawaiian or Other Pacific Islander",
  "American Indian or Alaska Native",
  "Two or more races",
  "Decline to answer",
];

function ynToBool(v: YesNo): boolean | undefined {
  if (v === "yes") return true;
  if (v === "no") return false;
  return undefined;
}

function boolToYn(b: boolean | undefined): YesNo {
  if (b === true) return "yes";
  if (b === false) return "no";
  return "";
}

function trimEducation(e: Education): Education {
  return {
    school: e.school?.trim() || undefined,
    degree: e.degree?.trim() || undefined,
    fieldOfStudy: e.fieldOfStudy?.trim() || undefined,
    gpa: e.gpa?.trim() || undefined,
    graduationDate: e.graduationDate?.trim() || undefined,
  };
}

function trimExperience(e: Experience): Experience {
  return {
    company: e.company?.trim() || undefined,
    title: e.title?.trim() || undefined,
    startDate: e.startDate?.trim() || undefined,
    endDate: e.endDate?.trim() || undefined,
    description: e.description?.trim() || undefined,
  };
}

function hasAnyValue(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some((v) => v !== undefined && v !== "");
}

/** Splits on commas and newlines so a pasted resume skills line just works. */
function splitSkills(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n;]+/)) {
    const skill = part.trim();
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!EMAIL_RE.test(trimmed)) return "Please enter a valid email address.";
  return null;
}

function Section({
  title,
  open = true,
  children,
}: {
  title: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="section" open={open}>
      <summary className="section__summary">
        <span className="section__title">{title}</span>
      </summary>
      <div className="section__body">{children}</div>
    </details>
  );
}

type Props = {
  onComplete: () => void;
  onCancel?: () => void;
};

export function OnboardingForm({ onComplete, onCancel }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [citizenship, setCitizenship] = useState("");
  const [workAuthUS, setWorkAuthUS] = useState<YesNo>("");
  const [sponsorship, setSponsorship] = useState<YesNo>("");
  const [educations, setEducations] = useState<Education[]>([{}]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  /* Held as raw comma-separated text so partial typing survives a draft save. */
  const [skills, setSkills] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [gender, setGender] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [veteranStatus, setVeteranStatus] = useState("");
  const [disabilityStatus, setDisabilityStatus] = useState("");
  const [raceEthnicity, setRaceEthnicity] = useState<string[]>([]);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeFeedback, setResumeFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void (async () => {
      const profile = await getProfile();
      const identity = profile?.identity;
      if (identity) {
      if (identity.legalName?.first) setFirstName(identity.legalName.first);
      if (identity.legalName?.last) setLastName(identity.legalName.last);
      if (identity.contact?.email) setEmail(identity.contact.email);
      if (identity.contact?.phone) setPhone(identity.contact.phone);
      if (identity.workAuth?.citizenshipStatus) {
        setCitizenship(identity.workAuth.citizenshipStatus);
      }
      setWorkAuthUS(boolToYn(identity.workAuth?.authorizedToWorkInUS));
      setSponsorship(boolToYn(identity.workAuth?.requiresSponsorship));
      if (identity.educations && identity.educations.length > 0) {
        setEducations(identity.educations);
      }
      if (identity.experiences) {
        setExperiences(identity.experiences);
      }
      if (identity.links?.linkedin) setLinkedin(identity.links.linkedin);
      if (identity.links?.github) setGithub(identity.links.github);
      if (identity.links?.portfolio) setPortfolio(identity.links.portfolio);
      const addr = identity.contact?.address;
      if (addr?.street) setStreet(addr.street);
      if (addr?.city) setCity(addr.city);
      if (addr?.state) setState(addr.state);
      if (addr?.zip) setZip(addr.zip);
      if (addr?.country) setCountry(addr.country);
      const demo = identity.demographics;
      if (demo?.gender) setGender(demo.gender);
      if (demo?.pronouns) setPronouns(demo.pronouns);
      if (demo?.veteranStatus) setVeteranStatus(demo.veteranStatus);
      if (demo?.disabilityStatus) setDisabilityStatus(demo.disabilityStatus);
      if (demo?.raceEthnicity && demo.raceEthnicity.length > 0) {
        setRaceEthnicity(demo.raceEthnicity);
      }
      }
      if (profile?.skills && profile.skills.length > 0) {
        setSkills(profile.skills.join(", "));
      }
      const draft = await loadOnboardingDraft();
      if (draft) {
        if (draft.firstName !== undefined) setFirstName(draft.firstName);
        if (draft.lastName !== undefined) setLastName(draft.lastName);
        if (draft.email !== undefined) setEmail(draft.email);
        if (draft.phone !== undefined) setPhone(draft.phone);
        if (draft.citizenship !== undefined) setCitizenship(draft.citizenship);
        if (draft.workAuthUS !== undefined) {
          setWorkAuthUS(draft.workAuthUS as YesNo);
        }
        if (draft.sponsorship !== undefined) {
          setSponsorship(draft.sponsorship as YesNo);
        }
        if (draft.educations && draft.educations.length > 0) {
          setEducations(draft.educations);
        }
        if (draft.experiences) setExperiences(draft.experiences);
        if (draft.linkedin !== undefined) setLinkedin(draft.linkedin);
        if (draft.github !== undefined) setGithub(draft.github);
        if (draft.portfolio !== undefined) setPortfolio(draft.portfolio);
        if (draft.street !== undefined) setStreet(draft.street);
        if (draft.city !== undefined) setCity(draft.city);
        if (draft.state !== undefined) setState(draft.state);
        if (draft.zip !== undefined) setZip(draft.zip);
        if (draft.country !== undefined) setCountry(draft.country);
        if (draft.gender !== undefined) setGender(draft.gender);
        if (draft.pronouns !== undefined) setPronouns(draft.pronouns);
        if (draft.veteranStatus !== undefined) {
          setVeteranStatus(draft.veteranStatus);
        }
        if (draft.disabilityStatus !== undefined) {
          setDisabilityStatus(draft.disabilityStatus);
        }
        if (draft.raceEthnicity) setRaceEthnicity(draft.raceEthnicity);
        if (draft.skills !== undefined) setSkills(draft.skills);
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveOnboardingDraft({
      firstName,
      lastName,
      email,
      phone,
      citizenship,
      workAuthUS,
      sponsorship,
      educations,
      experiences,
      skills,
      linkedin,
      github,
      portfolio,
      street,
      city,
      state,
      zip,
      country,
      gender,
      pronouns,
      veteranStatus,
      disabilityStatus,
      raceEthnicity,
      updatedAt: Date.now(),
    });
  }, [
    hydrated,
    firstName,
    lastName,
    email,
    phone,
    citizenship,
    workAuthUS,
    sponsorship,
    educations,
    experiences,
    skills,
    linkedin,
    github,
    portfolio,
    street,
    city,
    state,
    zip,
    country,
    gender,
    pronouns,
    veteranStatus,
    disabilityStatus,
    raceEthnicity,
  ]);

  async function handleCancel() {
    if (!onCancel) return;
    await clearOnboardingDraft();
    onCancel();
  }

  function updateEducation(idx: number, patch: Partial<Education>) {
    setEducations((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  }

  function addEducation() {
    setEducations((prev) => [...prev, {}]);
  }

  function removeEducation(idx: number) {
    setEducations((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateExperience(idx: number, patch: Partial<Experience>) {
    setExperiences((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  }

  function addExperience() {
    setExperiences((prev) => [...prev, {}]);
  }

  function removeExperience(idx: number) {
    setExperiences((prev) => prev.filter((_, i) => i !== idx));
  }

  function applyPrefills(extracted: ExtractedFields): string[] {
    const filled: string[] = [];
    if (!firstName && extracted.firstName) {
      setFirstName(extracted.firstName);
      filled.push("first name");
    }
    if (!lastName && extracted.lastName) {
      setLastName(extracted.lastName);
      filled.push("last name");
    }
    if (!email && extracted.email) {
      setEmail(extracted.email);
      filled.push("email");
    }
    if (!phone && extracted.phone) {
      setPhone(extracted.phone);
      filled.push("phone");
    }
    const eduPatch: Partial<Education> = {};
    const firstEdu = educations[0] ?? {};
    if (!firstEdu.school && extracted.school) {
      eduPatch.school = extracted.school;
      filled.push("school");
    }
    if (!firstEdu.gpa && extracted.gpa) {
      eduPatch.gpa = extracted.gpa;
      filled.push("GPA");
    }
    if (!firstEdu.graduationDate && extracted.graduationDate) {
      eduPatch.graduationDate = extracted.graduationDate;
      filled.push("graduation date");
    }
    if (Object.keys(eduPatch).length > 0) {
      setEducations((prev) => {
        const next = [...prev];
        next[0] = { ...(next[0] ?? {}), ...eduPatch };
        return next;
      });
    }
    return filled;
  }

  async function onResumeFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResumeError(null);
    setResumeFeedback(null);
    try {
      const base64 = await fileToBase64(file);
      const now = Date.now();
      await addResume({
        id: crypto.randomUUID(),
        name: file.name,
        createdAt: now,
        updatedAt: now,
        originalFile: {
          filename: file.name,
          contentBase64: base64,
          mimeType: file.type || undefined,
        },
      });

      let message = `Saved "${file.name}".`;
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        try {
          const text = await extractTextFromPdf(file);
          const extracted = extractFields(text);
          const prefilled = applyPrefills(extracted);
          if (prefilled.length > 0) {
            message += ` Imported ${prefilled.length} field${
              prefilled.length > 1 ? "s" : ""
            } from your resume (${prefilled.join(", ")}).`;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          message += ` Couldn't read fields: ${msg}`;
        }
      }
      setResumeFeedback(message);
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleRace(value: string) {
    setRaceEthnicity((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("First name, last name, and email are required.");
      return;
    }
    const emailIssue = validateEmail(email);
    if (emailIssue) {
      setEmailError(emailIssue);
      setError(emailIssue);
      return;
    }
    setSaving(true);
    try {
      const trimmedEducations = educations.map(trimEducation).filter(hasAnyValue);
      const trimmedExperiences = experiences.map(trimExperience).filter(hasAnyValue);
      const parsedSkills = splitSkills(skills);
      await updateProfile({
        identity: {
          legalName: {
            first: firstName.trim(),
            last: lastName.trim(),
          },
          contact: {
            email: email.trim(),
            phone: phone.trim() || undefined,
            address: {
              street: street.trim() || undefined,
              city: city.trim() || undefined,
              state: state.trim() || undefined,
              zip: zip.trim() || undefined,
              country: country.trim() || undefined,
            },
          },
          workAuth: {
            citizenshipStatus: citizenship.trim() || undefined,
            authorizedToWorkInUS: ynToBool(workAuthUS),
            requiresSponsorship: ynToBool(sponsorship),
          },
          links: {
            linkedin: linkedin.trim() || undefined,
            github: github.trim() || undefined,
            portfolio: portfolio.trim() || undefined,
          },
          educations: trimmedEducations.length > 0 ? trimmedEducations : undefined,
          experiences: trimmedExperiences.length > 0 ? trimmedExperiences : undefined,
          demographics: {
            gender: gender.trim() || undefined,
            pronouns: pronouns.trim() || undefined,
            veteranStatus: veteranStatus.trim() || undefined,
            disabilityStatus: disabilityStatus.trim() || undefined,
            raceEthnicity:
              raceEthnicity.length > 0 ? raceEthnicity : undefined,
          },
        },
        skills: parsedSkills.length > 0 ? parsedSkills : undefined,
      });
      await clearOnboardingDraft();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="onboarding" onSubmit={onSubmit}>
      <p className="onboarding__intro">
        {onCancel
          ? "Update your saved details."
          : "Fill these in once. QuickApply will reuse them on every application."}
      </p>

      <Section title="Resume">
        <p className="onboarding__hint">
          Upload a PDF — we'll save it and try to prefill the fields below.
          Manage saved resumes in the main view.
        </p>
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf"
          onChange={onResumeFile}
          className="onboarding__file"
        />
        {resumeFeedback && (
          <p className="onboarding__feedback onboarding__feedback--ok">
            {resumeFeedback}
          </p>
        )}
        {resumeError && (
          <p className="onboarding__feedback onboarding__feedback--err">
            {resumeError}
          </p>
        )}
      </Section>

      <Section title="Personal">
        <div className="onboarding__row">
          <label className="onboarding__field">
            <span className="onboarding__label">
              First name
              <span className="onboarding__required" aria-hidden="true">
                *
              </span>
            </span>
            <input
              className="onboarding__input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </label>
          <label className="onboarding__field">
            <span className="onboarding__label">
              Last name
              <span className="onboarding__required" aria-hidden="true">
                *
              </span>
            </span>
            <input
              className="onboarding__input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
          </label>
        </div>

        <label className="onboarding__field">
          <span className="onboarding__label">
            Email
            <span className="onboarding__required" aria-hidden="true">
              *
            </span>
          </span>
          <input
            className="onboarding__input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            onBlur={() => setEmailError(validateEmail(email))}
            autoComplete="email"
            required
            aria-invalid={emailError !== null}
            aria-describedby={emailError ? "onboarding-email-error" : undefined}
          />
          {emailError && (
            <span
              id="onboarding-email-error"
              className="onboarding__field-error"
            >
              {emailError}
            </span>
          )}
        </label>

        <label className="onboarding__field">
          <span className="onboarding__label">Phone</span>
          <input
            className="onboarding__input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </label>
      </Section>

      <Section title="Links">
        <label className="onboarding__field">
          <span className="onboarding__label">LinkedIn</span>
          <input
            className="onboarding__input"
            type="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://linkedin.com/in/yourname"
          />
        </label>
        <label className="onboarding__field">
          <span className="onboarding__label">GitHub</span>
          <input
            className="onboarding__input"
            type="url"
            value={github}
            onChange={(e) => setGithub(e.target.value)}
            placeholder="https://github.com/yourname"
          />
        </label>
        <label className="onboarding__field">
          <span className="onboarding__label">Portfolio / website</span>
          <input
            className="onboarding__input"
            type="url"
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            placeholder="https://yourname.dev"
          />
        </label>
      </Section>

      <Section title="Work authorization">
        <label className="onboarding__field">
          <span className="onboarding__label">Citizenship status</span>
          <input
            className="onboarding__input"
            value={citizenship}
            onChange={(e) => setCitizenship(e.target.value)}
            placeholder="e.g. US Citizen"
          />
        </label>

        <div className="onboarding__row">
          <label className="onboarding__field">
            <span className="onboarding__label">
              Authorized to work in US?
            </span>
            <select
              className="onboarding__input"
              value={workAuthUS}
              onChange={(e) => setWorkAuthUS(e.target.value as YesNo)}
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="onboarding__field">
            <span className="onboarding__label">Requires sponsorship?</span>
            <select
              className="onboarding__input"
              value={sponsorship}
              onChange={(e) => setSponsorship(e.target.value as YesNo)}
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
      </Section>

      <Section title="Education">
        {educations.map((edu, idx) => (
          <div key={idx} className="onboarding__entry">
            <label className="onboarding__field">
              <span className="onboarding__label">School</span>
              <input
                className="onboarding__input"
                value={edu.school ?? ""}
                onChange={(e) =>
                  updateEducation(idx, { school: e.target.value })
                }
                placeholder="e.g. Vanderbilt University"
              />
            </label>
            <div className="onboarding__row">
              <label className="onboarding__field">
                <span className="onboarding__label">Degree</span>
                <input
                  className="onboarding__input"
                  value={edu.degree ?? ""}
                  onChange={(e) =>
                    updateEducation(idx, { degree: e.target.value })
                  }
                  placeholder="e.g. BS"
                />
              </label>
              <label className="onboarding__field">
                <span className="onboarding__label">Field of study</span>
                <input
                  className="onboarding__input"
                  value={edu.fieldOfStudy ?? ""}
                  onChange={(e) =>
                    updateEducation(idx, { fieldOfStudy: e.target.value })
                  }
                  placeholder="e.g. Computer Science"
                />
              </label>
            </div>
            <div className="onboarding__row">
              <label className="onboarding__field">
                <span className="onboarding__label">GPA</span>
                <input
                  className="onboarding__input"
                  value={edu.gpa ?? ""}
                  onChange={(e) =>
                    updateEducation(idx, { gpa: e.target.value })
                  }
                  placeholder="e.g. 3.8"
                />
              </label>
              <label className="onboarding__field">
                <span className="onboarding__label">Graduation date</span>
                <input
                  className="onboarding__input"
                  value={edu.graduationDate ?? ""}
                  onChange={(e) =>
                    updateEducation(idx, { graduationDate: e.target.value })
                  }
                  placeholder="e.g. 2026-05"
                />
              </label>
            </div>
            {educations.length > 1 && (
              <button
                type="button"
                className="onboarding__entry-remove"
                onClick={() => removeEducation(idx)}
              >
                Remove this education
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="onboarding__entry-add"
          onClick={addEducation}
        >
          + Add another education
        </button>
      </Section>

      <Section title="Skills" open={false}>
        <label className="onboarding__field">
          <span className="onboarding__label">Skills</span>
          <textarea
            className="onboarding__input"
            rows={3}
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Python, React, TypeScript, SQL"
          />
          <span className="onboarding__hint">
            Comma-separated. Workday asks for skills one at a time, so QuickApply
            adds each of these individually.
          </span>
        </label>
      </Section>

      <Section title="Experience" open={false}>
        {experiences.map((exp, idx) => (
          <div key={idx} className="onboarding__entry">
            <div className="onboarding__row">
              <label className="onboarding__field">
                <span className="onboarding__label">Company</span>
                <input
                  className="onboarding__input"
                  value={exp.company ?? ""}
                  onChange={(e) =>
                    updateExperience(idx, { company: e.target.value })
                  }
                  placeholder="e.g. Acme Corp"
                />
              </label>
              <label className="onboarding__field">
                <span className="onboarding__label">Title</span>
                <input
                  className="onboarding__input"
                  value={exp.title ?? ""}
                  onChange={(e) =>
                    updateExperience(idx, { title: e.target.value })
                  }
                  placeholder="e.g. Engineering Intern"
                />
              </label>
            </div>
            <div className="onboarding__row">
              <label className="onboarding__field">
                <span className="onboarding__label">Start date</span>
                <input
                  className="onboarding__input"
                  value={exp.startDate ?? ""}
                  onChange={(e) =>
                    updateExperience(idx, { startDate: e.target.value })
                  }
                  placeholder="e.g. 2025-05"
                />
              </label>
              <label className="onboarding__field">
                <span className="onboarding__label">End date</span>
                <input
                  className="onboarding__input"
                  value={exp.endDate ?? ""}
                  onChange={(e) =>
                    updateExperience(idx, { endDate: e.target.value })
                  }
                  placeholder="e.g. 2025-08 or Present"
                />
              </label>
            </div>
            <label className="onboarding__field">
              <span className="onboarding__label">Description</span>
              <textarea
                className="onboarding__input onboarding__textarea"
                value={exp.description ?? ""}
                onChange={(e) =>
                  updateExperience(idx, { description: e.target.value })
                }
                rows={3}
              />
            </label>
            <button
              type="button"
              className="onboarding__entry-remove"
              onClick={() => removeExperience(idx)}
            >
              Remove this experience
            </button>
          </div>
        ))}
        <button
          type="button"
          className="onboarding__entry-add"
          onClick={addExperience}
        >
          + Add experience
        </button>
      </Section>

      <Section title="Address" open={false}>
        <label className="onboarding__field">
          <span className="onboarding__label">Street</span>
          <input
            className="onboarding__input"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            autoComplete="street-address"
          />
        </label>

        <div className="onboarding__row">
          <label className="onboarding__field">
            <span className="onboarding__label">City</span>
            <input
              className="onboarding__input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
            />
          </label>
          <label className="onboarding__field">
            <span className="onboarding__label">State / Region</span>
            <input
              className="onboarding__input"
              value={state}
              onChange={(e) => setState(e.target.value)}
              autoComplete="address-level1"
            />
          </label>
        </div>

        <div className="onboarding__row">
          <label className="onboarding__field">
            <span className="onboarding__label">ZIP / Postal code</span>
            <input
              className="onboarding__input"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              autoComplete="postal-code"
            />
          </label>
          <label className="onboarding__field">
            <span className="onboarding__label">Country</span>
            <input
              className="onboarding__input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              autoComplete="country-name"
              placeholder="e.g. United States"
            />
          </label>
        </div>
      </Section>

      <Section title="Demographics" open={false}>
        <p className="onboarding__hint">
          Optional. Used for the voluntary EEO questions ATS forms ask.
        </p>

        <div className="onboarding__row">
          <label className="onboarding__field">
            <span className="onboarding__label">Gender</span>
            <input
              className="onboarding__input"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="e.g. Decline to identify"
            />
          </label>
          <label className="onboarding__field">
            <span className="onboarding__label">Pronouns</span>
            <input
              className="onboarding__input"
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              placeholder="e.g. they/them"
            />
          </label>
        </div>

        <label className="onboarding__field">
          <span className="onboarding__label">Veteran status</span>
          <input
            className="onboarding__input"
            value={veteranStatus}
            onChange={(e) => setVeteranStatus(e.target.value)}
            placeholder="e.g. I am not a protected veteran"
          />
        </label>

        <label className="onboarding__field">
          <span className="onboarding__label">Disability status</span>
          <input
            className="onboarding__input"
            value={disabilityStatus}
            onChange={(e) => setDisabilityStatus(e.target.value)}
            placeholder="e.g. I don't wish to answer"
          />
        </label>

        <div className="onboarding__field">
          <span className="onboarding__label">Race / Ethnicity</span>
          <div className="onboarding__checkboxes">
            {RACE_OPTIONS.map((opt) => (
              <label key={opt} className="onboarding__checkbox-row">
                <input
                  type="checkbox"
                  checked={raceEthnicity.includes(opt)}
                  onChange={() => toggleRace(opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      <div className="onboarding__sticky">
        {error && (
          <p className="onboarding__feedback onboarding__feedback--err">
            {error}
          </p>
        )}
        {onCancel ? (
          <div className="onboarding__actions">
            <button
              className="onboarding__cancel"
              type="button"
              onClick={() => void handleCancel()}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="onboarding__submit"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : (
          <button
            className="onboarding__submit"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save and continue"}
          </button>
        )}
      </div>
    </form>
  );
}
