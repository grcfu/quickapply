import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getProfile, updateProfile } from "../storage/profileStorage";

type YesNo = "" | "yes" | "no";

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
    })();
  }, []);

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
          },
          workAuth: {
            citizenshipStatus: citizenship.trim() || undefined,
            authorizedToWorkInUS: ynToBool(workAuthUS),
            requiresSponsorship: ynToBool(sponsorship),
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
