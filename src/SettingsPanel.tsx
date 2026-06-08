import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "./storage/profileStorage";
import type { LLMProvider, Settings } from "./types/profile";

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "none", label: "None (disabled)" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
];

export function SettingsPanel() {
  const [provider, setProvider] = useState<LLMProvider>("none");
  const [apiKey, setApiKey] = useState("");
  const [tone, setTone] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const profile = await getProfile();
      const settings = profile?.settings;
      if (settings?.llmProvider) setProvider(settings.llmProvider);
      if (settings?.llmApiKey) setApiKey(settings.llmApiKey);
      if (settings?.tonePreference) setTone(settings.tonePreference);
    })();
  }, []);

  async function persist(patch: Partial<Settings>) {
    setError(null);
    try {
      await updateProfile({ settings: patch });
      setSavedNote("Saved.");
      window.setTimeout(() => setSavedNote(null), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function onProviderChange(v: LLMProvider) {
    setProvider(v);
    void persist({ llmProvider: v });
  }

  function onKeyBlur() {
    const trimmed = apiKey.trim();
    void persist({ llmApiKey: trimmed || undefined });
  }

  function onToneBlur() {
    const trimmed = tone.trim();
    void persist({ tonePreference: trimmed || undefined });
  }

  return (
    <details className="panel">
      <summary className="panel__summary">
        <span className="panel__title">Settings</span>
      </summary>
      <div className="panel__body settings">
        <label className="settings__field">
          <span className="settings__label">LLM provider</span>
          <select
            className="settings__input"
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as LLMProvider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="settings__hint">
            Used for generating answers to open-ended questions. Key is
            stored locally in your browser only.
          </span>
        </label>

        <label className="settings__field">
          <span className="settings__label">API key</span>
          <div className="settings__row">
            <input
              className="settings__input"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onBlur={onKeyBlur}
              placeholder={provider === "none" ? "Select a provider first" : "sk-..."}
              disabled={provider === "none"}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="settings__toggle"
              onClick={() => setShowKey((v) => !v)}
              disabled={provider === "none"}
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label className="settings__field">
          <span className="settings__label">Tone preference</span>
          <textarea
            className="settings__input settings__textarea"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            onBlur={onToneBlur}
            rows={2}
            placeholder="e.g. concise, friendly, no buzzwords"
          />
        </label>

        {savedNote && (
          <p className="settings__feedback settings__feedback--ok">
            {savedNote}
          </p>
        )}
        {error && (
          <p className="settings__feedback settings__feedback--err">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
