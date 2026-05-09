import { useEffect, useRef, useState } from "react";
import {
  clearProfile,
  exportProfile,
  getProfile,
  importProfile,
  saveProfile,
} from "../storage/profileStorage";
import { makeSampleProfile } from "./sampleProfile";
import type { Profile } from "../types/profile";

type Status =
  | { kind: "idle" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

export function DebugPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setProfile(await getProfile());
  }

  useEffect(() => {
    void refresh();
  }, []);

  function reportOk(message: string) {
    setStatus({ kind: "ok", message });
  }
  function reportErr(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus({ kind: "error", message });
  }

  async function onLoadTest() {
    try {
      await saveProfile(makeSampleProfile());
      await refresh();
      reportOk("Loaded test profile.");
    } catch (err) {
      reportErr(err);
    }
  }

  async function onClear() {
    try {
      await clearProfile();
      await refresh();
      setShowJson(false);
      reportOk("Profile cleared.");
    } catch (err) {
      reportErr(err);
    }
  }

  async function onExport() {
    try {
      const json = await exportProfile();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quickapply-profile-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      reportOk("Export started.");
    } catch (err) {
      reportErr(err);
    }
  }

  function onImportClick() {
    fileInputRef.current?.click();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      await importProfile(text);
      await refresh();
      reportOk(`Imported ${file.name}.`);
    } catch (err) {
      reportErr(err);
    }
  }

  return (
    <section className="debug">
      <h2 className="debug__section-label">Debug</h2>

      <div className="debug__grid">
        <button className="debug__btn" onClick={onLoadTest}>
          Load test profile
        </button>
        <button
          className="debug__btn"
          onClick={() => setShowJson((v) => !v)}
        >
          {showJson ? "Hide" : "View"} profile JSON
        </button>
        <button className="debug__btn" onClick={onExport}>
          Export profile
        </button>
        <button className="debug__btn" onClick={onImportClick}>
          Import profile
        </button>
        <button
          className="debug__btn debug__btn--danger"
          onClick={onClear}
        >
          Clear profile
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={onImportFile}
      />

      <div className="debug__status">
        <div>
          <span className="debug__status-key">Status</span>{" "}
          {profile ? (
            <span>
              loaded · {profile.resumes?.length ?? 0} resumes ·{" "}
              {profile.answers?.length ?? 0} answers
            </span>
          ) : (
            <span>no profile in storage</span>
          )}
        </div>
        {status.kind !== "idle" && (
          <div
            className={`debug__feedback debug__feedback--${
              status.kind === "ok" ? "ok" : "err"
            }`}
          >
            {status.message}
          </div>
        )}
      </div>

      {showJson && (
        <pre className="debug__json">
          {profile
            ? JSON.stringify(profile, null, 2)
            : "(no profile in storage)"}
        </pre>
      )}
    </section>
  );
}
