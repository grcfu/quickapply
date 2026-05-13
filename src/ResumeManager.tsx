import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  addResume,
  getProfile,
  removeResume,
  updateProfile,
} from "./storage/profileStorage";
import { fileToBase64 } from "./resume/fileUtils";
import type { ResumeProfile } from "./types/profile";

export function ResumeManager() {
  const [resumes, setResumes] = useState<ResumeProfile[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        />
      </label>
      {error && <p className="resumes__error">{error}</p>}
      </div>
    </details>
  );
}
