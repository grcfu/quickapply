import { useEffect, useState } from "react";
import {
  computeCompleteness,
  type CompletenessResult,
} from "./completeness";
import { getProfile } from "./storage/profileStorage";

export function ProfileCompleteness() {
  const [result, setResult] = useState<CompletenessResult | null>(null);

  useEffect(() => {
    void (async () => {
      const profile = await getProfile();
      setResult(computeCompleteness(profile));
    })();
  }, []);

  if (!result) return null;
  if (result.percent === 100) return null;

  const missing = result.buckets.filter((b) => !b.filled);

  return (
    <section className="completeness">
      <div className="completeness__head">
        <span className="completeness__title">Profile</span>
        <span className="completeness__percent">{result.percent}%</span>
      </div>
      <div
        className="completeness__bar"
        role="progressbar"
        aria-valuenow={result.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="completeness__bar-fill"
          style={{ width: `${result.percent}%` }}
        />
      </div>
      {missing.length > 0 && (
        <div className="completeness__missing">
          <span className="completeness__missing-label">Missing:</span>
          {missing.map((b) => (
            <span key={b.key} className="completeness__chip">
              {b.label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
