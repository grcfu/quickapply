import { useEffect, useState } from "react";
import { getProfile, removeResume } from "./storage/profileStorage";

type ResumeInfo = { id: string; filename: string };

export function ResumeStatus() {
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const profile = await getProfile();
      const r = profile?.resumes?.[0];
      if (r?.originalFile) {
        setResume({ id: r.id, filename: r.originalFile.filename });
      }
    })();
  }, []);

  async function onRemove() {
    if (!resume) return;
    try {
      await removeResume(resume.id);
      setResume(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!resume) {
    return (
      <p className="resume-status resume-status--empty">
        No resume on file — upload one via Edit profile.
      </p>
    );
  }

  return (
    <div className="resume-status">
      <div className="resume-status__row">
        <span className="resume-status__label">Resume</span>
        <span className="resume-status__name">{resume.filename}</span>
        <button
          type="button"
          className="resume-status__remove"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
      {error && <p className="resume-status__error">{error}</p>}
    </div>
  );
}
