import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  addResume,
  getProfile,
  removeResume,
  setResumeParsedData,
  updateProfile,
} from "./storage/profileStorage";
import { extractFields } from "./resume/extractFields";
import { extractTextFromPdf } from "./resume/extractText";
import { fileToBase64 } from "./resume/fileUtils";
import type { ParsedResumeData, ResumeProfile } from "./types/profile";

/**
 * A parse waiting on the user's approval. Held in component state rather than
 * written straight to the resume: `pickSkills` / `pickExperiences` merge stored
 * parsed data into what autofill types onto a live application, and a regex
 * parse of a PDF is wrong often enough that it should not take effect unseen.
 */
type PendingParse = {
  resumeId: string;
  filename: string;
  parsed: ParsedResumeData;
};

function parsedSummary(parsed: ParsedResumeData | undefined): string | null {
  if (!parsed) return null;
  const parts: string[] = [];
  const experiences = parsed.experiences?.length ?? 0;
  const skills = parsed.skills?.length ?? 0;
  if (experiences > 0) {
    parts.push(`${experiences} experience${experiences === 1 ? "" : "s"}`);
  }
  if (skills > 0) parts.push(`${skills} skill${skills === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function ResumeManager() {
  const [resumes, setResumes] = useState<ResumeProfile[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingParse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const profile = await getProfile();
      setResumes(profile?.resumes ?? []);
      setDefaultId(profile?.settings?.defaultResumeId ?? null);
    })();
  }, []);

  async function refresh() {
    const profile = await getProfile();
    setResumes(profile?.resumes ?? []);
    setDefaultId(profile?.settings?.defaultResumeId ?? null);
  }

  async function onSetDefault(id: string) {
    try {
      await updateProfile({ settings: { defaultResumeId: id } });
      setDefaultId(id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onAddFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setPending(null);
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const id = crypto.randomUUID();
      const now = Date.now();
      await addResume({
        id,
        name: file.name,
        createdAt: now,
        updatedAt: now,
        originalFile: {
          filename: file.name,
          contentBase64: base64,
          mimeType: file.type || undefined,
        },
      });
      await refresh();

      /* Only PDFs — `extractTextFromPdf` is the only reader there is, so a
       * .docx is stored and attached but contributes no parsed fields. */
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) return;
      const fields = extractFields(await extractTextFromPdf(file));
      const parsed: ParsedResumeData = {
        school: fields.school,
        gpa: fields.gpa,
        graduationDate: fields.graduationDate,
        experiences: fields.experiences,
        skills: fields.skills,
      };
      if (!parsedSummary(parsed)) return;
      setPending({ resumeId: id, filename: file.name, parsed });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onAcceptParsed() {
    if (!pending) return;
    try {
      await setResumeParsedData(pending.resumeId, pending.parsed);
      setPending(null);
      await refresh();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  /** Clears parsed data off a resume that already has some, from the list. */
  async function onDropParsed(id: string) {
    try {
      await setResumeParsedData(id, undefined);
      await refresh();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onRemove(id: string) {
    try {
      await removeResume(id);
      await refresh();
      if (pending?.resumeId === id) setPending(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <details className="panel" open>
      <summary className="panel__summary">
        <span className="panel__title">Resumes</span>
        {resumes.length > 0 && (
          <span className="panel__count">{resumes.length}</span>
        )}
      </summary>
      <div className="panel__body">
      {resumes.length === 0 ? (
        <p className="resumes__empty">No resumes yet.</p>
      ) : (
        <ul className="resumes__list">
          {resumes.map((r) => {
            const isDefault = r.id === defaultId;
            const summary = parsedSummary(r.parsedData);
            return (
              <li
                key={r.id}
                className={
                  isDefault
                    ? "resumes__item resumes__item--default"
                    : "resumes__item"
                }
              >
                <input
                  type="radio"
                  name="defaultResume"
                  className="resumes__default"
                  checked={isDefault}
                  onChange={() => onSetDefault(r.id)}
                  aria-label={`Use ${
                    r.originalFile?.filename ?? r.name
                  } as default`}
                />
                <span className="resumes__name">
                  {r.originalFile?.filename ?? r.name}
                </span>
                {isDefault && (
                  <span className="resumes__default-badge">Default</span>
                )}
                <button
                  type="button"
                  className="resumes__remove"
                  onClick={() => onRemove(r.id)}
                >
                  Remove
                </button>
                {summary && (
                  <span className="resumes__parsed">
                    Adds {summary} to autofill
                    <button
                      type="button"
                      className="resumes__parsed-drop"
                      onClick={() => onDropParsed(r.id)}
                    >
                      Don't use
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <label className="resumes__add">
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf"
          onChange={onAddFile}
          disabled={busy}
        />
      </label>
      {busy && <p className="resumes__busy">Reading resume…</p>}
      {pending && (
        <div className="resumes__review">
          <p className="resumes__review-head">
            Found in {pending.filename} — these get{" "}
            <strong>added to</strong> your saved experiences and skills, not
            swapped in for them.
          </p>
          {pending.parsed.experiences &&
            pending.parsed.experiences.length > 0 && (
              <ul className="resumes__review-list">
                {pending.parsed.experiences.map((exp, i) => (
                  <li key={i}>
                    <strong>{exp.title ?? "(no title)"}</strong>
                    {exp.company ? ` — ${exp.company}` : ""}
                    {exp.startDate
                      ? ` (${exp.startDate}${
                          exp.endDate ? ` – ${exp.endDate}` : ""
                        })`
                      : ""}
                  </li>
                ))}
              </ul>
            )}
          {pending.parsed.skills && pending.parsed.skills.length > 0 && (
            <p className="resumes__review-skills">
              <strong>Skills:</strong> {pending.parsed.skills.join(", ")}
            </p>
          )}
          <div className="resumes__review-actions">
            <button
              type="button"
              className="resumes__review-accept"
              onClick={onAcceptParsed}
            >
              Use these
            </button>
            <button
              type="button"
              className="resumes__review-discard"
              onClick={() => setPending(null)}
            >
              Discard
            </button>
          </div>
        </div>
      )}
      {error && <p className="resumes__error">{error}</p>}
      </div>
    </details>
  );
}
