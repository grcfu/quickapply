import { getProfile } from "../storage/profileStorage";
import type { AutofillResponse } from "../messages";
import { findMatchingOption, setReactValue, setSelectValue } from "./fillField";
import { getFieldMapForHost } from "./fieldMapRegistry";
import type {
  GreenhouseFieldDef,
  InputFieldDef,
  SelectFieldDef,
} from "./greenhouseFields";

function findInput(def: InputFieldDef): HTMLInputElement | null {
  for (const sel of def.selectors) {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (el) return el;
  }
  if (def.labelPatterns && def.labelPatterns.length > 0) {
    for (const label of Array.from(document.querySelectorAll("label"))) {
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

function findSelectByLabel(def: SelectFieldDef): HTMLSelectElement | null {
  for (const label of Array.from(document.querySelectorAll("label"))) {
    const text = (label.textContent ?? "").trim();
    if (!def.labelPatterns.some((p) => p.test(text))) continue;
    const forId = label.getAttribute("for");
    if (forId) {
      const el = document.getElementById(forId);
      if (el instanceof HTMLSelectElement) return el;
    }
    const nested = label.querySelector("select");
    if (nested instanceof HTMLSelectElement) return nested;
    let container: HTMLElement | null = label.parentElement;
    for (let i = 0; i < 4 && container; i++) {
      const select = container.querySelector("select");
      if (select instanceof HTMLSelectElement) return select;
      container = container.parentElement;
    }
  }
  return null;
}

function fillField(
  key: string,
  def: GreenhouseFieldDef,
  value: string,
): { ok: true } | { ok: false; reason: string } {
  if (def.kind === "input") {
    const el = findInput(def);
    if (!el) return { ok: false, reason: `${key} (field not found)` };
    setReactValue(el, value);
    return { ok: true };
  }
  const select = findSelectByLabel(def);
  if (!select) return { ok: false, reason: `${key} (select not found)` };
  const option = findMatchingOption(select, value);
  if (!option) {
    return {
      ok: false,
      reason: `${key} (no option matched "${value}")`,
    };
  }
  setSelectValue(select, option.value);
  return { ok: true };
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
  const fieldMap = getFieldMapForHost(window.location.hostname);
  if (!fieldMap) {
    return {
      ok: false,
      filled: 0,
      fields: [],
      skipped: [],
      error: `No adapter for host ${window.location.hostname}.`,
    };
  }
  const fields: string[] = [];
  const skipped: string[] = [];
  for (const [key, def] of Object.entries(fieldMap)) {
    const value = def.getValue(profile);
    if (!value) {
      skipped.push(`${key} (no value in profile)`);
      continue;
    }
    const result = fillField(key, def, value);
    if (result.ok) {
      fields.push(key);
    } else {
      skipped.push(result.reason);
    }
  }
  return { ok: true, filled: fields.length, fields, skipped };
}
