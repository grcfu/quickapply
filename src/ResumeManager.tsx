import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  addResume,
  getProfile,
  removeResume,
} from "./storage/profileStorage";
import { fileToBase64 } from "./resume/fileUtils";
import type { ResumeProfile } from "./types/profile";

export function ResumeManager() {
  const [resumes, setResumes] = useState<ResumeProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const profile = await getProfile();
      setResumes(profile?.resumes ?? []);
    })();
  }, []);

  async function refresh() {
    const profile = await getProfile();
    setResumes(profile?.resumes ?? []);
  }

  async function onAddFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onRemove(id: string) {
    try {
      await removeResume(id);
      await refresh();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="resumes">
      <h2 className="resumes__heading">Resumes</h2>
      {resumes.length === 0 ? (
        <p className="resumes__empty">No resumes yet.</p>
      ) : (
        <ul className="resumes__list">
          {resumes.map((r) => (
            <li key={r.id} className="resumes__item">
              <span className="resumes__name">
                {r.originalFile?.filename ?? r.name}
              </span>
              <button
                type="button"
                className="resumes__remove"
                onClick={() => onRemove(r.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="resumes__add">
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf"
          onChange={onAddFile}
        />
      </label>
      {error && <p className="resumes__error">{error}</p>}
    </section>
  );
}
