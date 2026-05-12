import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  addResume,
  getProfile,
  updateProfile,
} from "../storage/profileStorage";
import { extractTextFromPdf } from "../resume/extractText";
import { extractFields } from "../resume/extractFields";
import type { ExtractedFields } from "../resume/extractFields";
import { fileToBase64 } from "../resume/fileUtils";

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
  const [school, setSchool] = useState("");
  const [degree, setDegree] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [gpa, setGpa] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
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

  useEffect(() => {
    void (async () => {
      const profile = await getProfile();
      const identity = profile?.identity;
      if (!identity) return;
      if (identity.legalName?.first) setFirstName(identity.legalName.first);
      if (identity.legalName?.last) setLastName(identity.legalName.last);
      if (identity.contact?.email) setEmail(identity.contact.email);
      if (identity.contact?.phone) setPhone(identity.contact.phone);
      if (identity.workAuth?.citizenshipStatus) {
        setCitizenship(identity.workAuth.citizenshipStatus);
      }
      setWorkAuthUS(boolToYn(identity.workAuth?.authorizedToWorkInUS));
      setSponsorship(boolToYn(identity.workAuth?.requiresSponsorship));
      if (identity.education?.school) setSchool(identity.education.school);
      if (identity.education?.degree) setDegree(identity.education.degree);
      if (identity.education?.fieldOfStudy) {
        setFieldOfStudy(identity.education.fieldOfStudy);
      }
      if (identity.education?.gpa) setGpa(identity.education.gpa);
      if (identity.education?.graduationDate) {
        setGraduationDate(identity.education.graduationDate);
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
    })();
  }, []);

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
    if (!school && extracted.school) {
      setSchool(extracted.school);
      filled.push("school");
    }
    if (!gpa && extracted.gpa) {
      setGpa(extracted.gpa);
      filled.push("GPA");
    }
    if (!graduationDate && extracted.graduationDate) {
      setGraduationDate(extracted.graduationDate);
      filled.push("graduation date");
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
    setSaving(true);
    try {
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
          education: {
            school: school.trim() || undefined,
            degree: degree.trim() || undefined,
            fieldOfStudy: fieldOfStudy.trim() || undefined,
            gpa: gpa.trim() || undefined,
            graduationDate: graduationDate.trim() || undefined,
          },
          demographics: {
            gender: gender.trim() || undefined,
            pronouns: pronouns.trim() || undefined,
            veteranStatus: veteranStatus.trim() || undefined,
            disabilityStatus: disabilityStatus.trim() || undefined,
            raceEthnicity:
              raceEthnicity.length > 0 ? raceEthnicity : undefined,
          },
        },
      });
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

      <h2 className="onboarding__section">Resume</h2>
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

      <h2 className="onboarding__section">Personal</h2>

      <div className="onboarding__row">
        <label className="onboarding__field">
          <span className="onboarding__label">First name</span>
          <input
            className="onboarding__input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
          />
        </label>
        <label className="onboarding__field">
          <span className="onboarding__label">Last name</span>
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
        <span className="onboarding__label">Email</span>
        <input
          className="onboarding__input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
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

      <h2 className="onboarding__section">Links</h2>

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

      <h2 className="onboarding__section">Work authorization</h2>

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

      <h2 className="onboarding__section">Education</h2>

      <label className="onboarding__field">
        <span className="onboarding__label">School</span>
        <input
          className="onboarding__input"
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          placeholder="e.g. Vanderbilt University"
        />
      </label>

      <div className="onboarding__row">
        <label className="onboarding__field">
          <span className="onboarding__label">Degree</span>
          <input
            className="onboarding__input"
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            placeholder="e.g. BS"
          />
        </label>
        <label className="onboarding__field">
          <span className="onboarding__label">Field of study</span>
          <input
            className="onboarding__input"
            value={fieldOfStudy}
            onChange={(e) => setFieldOfStudy(e.target.value)}
            placeholder="e.g. Computer Science"
          />
        </label>
      </div>

      <div className="onboarding__row">
        <label className="onboarding__field">
          <span className="onboarding__label">GPA</span>
          <input
            className="onboarding__input"
            value={gpa}
            onChange={(e) => setGpa(e.target.value)}
            placeholder="e.g. 3.8"
          />
        </label>
        <label className="onboarding__field">
          <span className="onboarding__label">Graduation date</span>
          <input
            className="onboarding__input"
            value={graduationDate}
            onChange={(e) => setGraduationDate(e.target.value)}
            placeholder="e.g. 2026-05"
          />
        </label>
      </div>

      <h2 className="onboarding__section">Address</h2>

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

      <h2 className="onboarding__section">Demographics</h2>
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
            onClick={onCancel}
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
    </form>
  );
}
