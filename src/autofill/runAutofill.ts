import { getProfile } from "../storage/profileStorage";
import type { AutofillResponse } from "../messages";
import { setReactValue } from "./fillField";
import { greenhouseFieldMap } from "./greenhouseFields";
import type { FieldDefinition } from "./greenhouseFields";

function findField(def: FieldDefinition): HTMLInputElement | null {
  for (const sel of def.selectors) {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (el) return el;
  }
  if (def.labelPatterns && def.labelPatterns.length > 0) {
    const labels = Array.from(document.querySelectorAll("label"));
    for (const label of labels) {
      const text = (label.textContent ?? "").trim();
      if (!def.labelPatterns.some((p) => p.test(text))) continue;
      const forId = label.getAttribute("for");
      if (forId) {
        const input = document.getElementById(forId);
        if (input instanceof HTMLInputElement) return input;
      }
      const nested = label.querySelector("input");
      if (nested instanceof HTMLInputElement) return nested;
    }
  }
  return null;
}

export async function runAutofill(): Promise<AutofillResponse> {
  const profile = await getProfile();
  if (!profile) {
    return {
      ok: false,
      filled: 0,
      fields: [],
      skipped: [],
      error: "No profile loaded — open the extension and Load test profile.",
    };
  }
  const filled: string[] = [];
  const skipped: string[] = [];
  for (const [key, def] of Object.entries(greenhouseFieldMap)) {
    const value = def.getValue(profile);
    if (!value) {
      skipped.push(`${key} (no value in profile)`);
      continue;
    }
    const el = findField(def);
    if (!el) {
      skipped.push(`${key} (field not found on page)`);
      continue;
    }
    setReactValue(el, value);
    filled.push(key);
  }
  return { ok: true, filled: filled.length, fields: filled, skipped };
}
