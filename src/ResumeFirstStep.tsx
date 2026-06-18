import { useState } from "react";
import type { ChangeEvent } from "react";
import { extractFields } from "./resume/extractFields";
import type { ExtractedFields } from "./resume/extractFields";
import { extractTextFromPdf } from "./resume/extractText";
import { fileToBase64 } from "./resume/fileUtils";
import {
  addResume,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from "./storage/profileStorage";

type Props = {
  onContinue: () => void;
  onSkip: () => void;
};

function hasAnyExtracted(e: ExtractedFields): boolean {
  return Boolean(
    e.firstName ||
      e.lastName ||
      e.email ||
      e.phone ||
      e.school ||
      e.gpa ||
      e.graduationDate ||
      (e.skills && e.skills.length > 0),
  );
}

export function ResumeFirstStep({ onContinue, onSkip }: Props) {
  const [busy, setBusy] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
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
      setFilename(file.name);

      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      let ext: ExtractedFields = {};
      if (isPdf) {
        const text = await extractTextFromPdf(file);
        ext = extractFields(text);
        if (hasAnyExtracted(ext)) {
          const existing = (await loadOnboardingDraft()) ?? {
            updatedAt: 0,
          };
          await saveOnboardingDraft({
            ...existing,
            firstName: existing.firstName || ext.firstName,
            lastName: existing.lastName || ext.lastName,
            email: existing.email || ext.email,
            phone: existing.phone || ext.phone,
            educations:
              existing.educations && existing.educations.length > 0
                ? existing.educations
                : [
                    {
                      school: ext.school,
                      gpa: ext.gpa,
                      graduationDate: ext.graduationDate,
                    },
                  ],
            updatedAt: Date.now(),
          });
        }
      }
      setExtracted(ext);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const showFound = extracted !== null;
  const found = extracted ?? {};
  const foundAny = showFound && hasAnyExtracted(found);

  return (
    <div className="resume-first">
      <div className="resume-first__progress">Step 1 of 2</div>
      <h2 className="resume-first__title">Upload your resume</h2>
      <p className="resume-first__subtitle">
        We'll save it and try to pre-fill your profile. Or skip and fill in
        the form manually.
      </p>

      {!showFound && (
        <>
          <label className="resume-first__drop">
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              onChange={onFile}
              disabled={busy}
              className="resume-first__drop-input"
            />
            <div className="resume-first__drop-content">
              <div className="resume-first__drop-icon" aria-hidden="true">
                ↑
              </div>
              <div className="resume-first__drop-text">
                {busy ? "Reading…" : "Click to upload a PDF"}
              </div>
              <div className="resume-first__drop-hint">
                PDF works best — we'll parse text to prefill name, email,
                school, and more.
              </div>
            </div>
          </label>
          {error && (
            <p className="resume-first__error">{error}</p>
          )}
          <button
            type="button"
            className="resume-first__skip"
            onClick={onSkip}
            disabled={busy}
          >
            Skip — fill manually
          </button>
        </>
      )}

      {showFound && (
        <>
          <div className="resume-first__found">
            <div className="resume-first__found-head">
              <span className="resume-first__found-dot" aria-hidden="true" />
              <span className="resume-first__found-label">
                {filename ?? "Resume"}
              </span>
            </div>
            {foundAny ? (
              <>
                <p className="resume-first__found-intro">
                  We found these — review on the next screen:
                </p>
                <ul className="resume-first__found-list">
                  {found.firstName && found.lastName && (
                    <li>
                      <strong>Name:</strong> {found.firstName} {found.lastName}
                    </li>
                  )}
                  {found.email && (
                    <li>
                      <strong>Email:</strong> {found.email}
                    </li>
                  )}
                  {found.phone && (
                    <li>
                      <strong>Phone:</strong> {found.phone}
                    </li>
                  )}
                  {found.school && (
                    <li>
                      <strong>School:</strong> {found.school}
                    </li>
                  )}
                  {found.gpa && (
                    <li>
                      <strong>GPA:</strong> {found.gpa}
                    </li>
                  )}
                  {found.graduationDate && (
                    <li>
                      <strong>Graduation:</strong> {found.graduationDate}
                    </li>
                  )}
                </ul>
              </>
            ) : (
              <p className="resume-first__found-intro">
                Saved, but we couldn't auto-extract fields from this file.
                You'll fill the form manually on the next screen.
              </p>
            )}
          </div>

          <button
            type="button"
            className="resume-first__continue"
            onClick={onContinue}
          >
            Continue
          </button>

          <label className="resume-first__replace">
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              onChange={onFile}
              disabled={busy}
            />
            <span>Or upload a different file</span>
          </label>
        </>
      )}
    </div>
  );
}
