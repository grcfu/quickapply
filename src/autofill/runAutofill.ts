import { getProfile } from "../storage/profileStorage";
import type { AutofillResponse } from "../messages";
import {
  base64ToFile,
  findMatchingOption,
  setCheckboxChecked,
  setFileValue,
  setReactValue,
  setSelectValue,
} from "./fillField";
import { getFieldMapForHost } from "./fieldMapRegistry";
import type {
  FileFieldDef,
  InputFieldDef,
  MultiCheckboxFieldDef,
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

function findCheckboxGroup(patterns: RegExp[]): HTMLElement | null {
  for (const fs of Array.from(document.querySelectorAll("fieldset"))) {
    const legend = fs.querySelector("legend");
    const text = (legend?.textContent ?? "").trim();
    if (patterns.some((p) => p.test(text))) return fs;
  }
  for (const el of Array.from(
    document.querySelectorAll("label, h2, h3, h4, p, span, div"),
  )) {
    const text = (el.textContent ?? "").trim();
    if (text.length > 200) continue;
    if (!patterns.some((p) => p.test(text))) continue;
    let container: HTMLElement | null = el.parentElement;
    for (let i = 0; i < 4 && container; i++) {
      const cbs = container.querySelectorAll('input[type="checkbox"]');
      if (cbs.length >= 2) return container;
      container = container.parentElement;
    }
  }
  return null;
}

function findCheckboxByLabel(
  container: HTMLElement,
  desired: string,
): HTMLInputElement | null {
  const checkboxes = Array.from(
    container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  );
  const candidates: { input: HTMLInputElement; text: string }[] = [];
  for (const cb of checkboxes) {
    let labelText = "";
    if (cb.id) {
      const lbl = container.querySelector(`label[for="${CSS.escape(cb.id)}"]`);
      if (lbl) labelText = (lbl.textContent ?? "").trim();
    }
    if (!labelText) {
      const parent = cb.closest("label");
      if (parent) labelText = (parent.textContent ?? "").trim();
    }
    if (!labelText) continue;
    candidates.push({ input: cb, text: labelText });
  }
  const target = desired.trim().toLowerCase();
  if (!target) return null;
  const exact = candidates.find((c) => c.text.toLowerCase() === target);
  if (exact) return exact.input;
  const subs = candidates.filter((c) => {
    const t = c.text.toLowerCase();
    return t.includes(target) || target.includes(t);
  });
  if (subs.length > 0) {
    subs.sort((a, b) => a.text.length - b.text.length);
    return subs[0].input;
  }
  return null;
}

function fillField(
  key: string,
  def: InputFieldDef | SelectFieldDef,
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

function findFileInput(def: FileFieldDef): HTMLInputElement | null {
  for (const sel of def.selectors) {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (el && el.type === "file") return el;
  }
  if (def.labelPatterns && def.labelPatterns.length > 0) {
    for (const label of Array.from(document.querySelectorAll("label"))) {
      const text = (label.textContent ?? "").trim();
      if (!def.labelPatterns.some((p) => p.test(text))) continue;
      const forId = label.getAttribute("for");
      if (forId) {
        const input = document.getElementById(forId);
        if (input instanceof HTMLInputElement && input.type === "file") {
          return input;
        }
      }
      const nested = label.querySelector('input[type="file"]');
      if (nested instanceof HTMLInputElement) return nested;
      let container: HTMLElement | null = label.parentElement;
      for (let i = 0; i < 4 && container; i++) {
        const file = container.querySelector('input[type="file"]');
        if (file instanceof HTMLInputElement) return file;
        container = container.parentElement;
      }
    }
  }
  return null;
}

function fillFileField(
  key: string,
  def: FileFieldDef,
  source: { contentBase64: string; filename: string; mimeType?: string },
): { ok: true } | { ok: false; reason: string } {
  const input = findFileInput(def);
  if (!input) return { ok: false, reason: `${key} (file input not found)` };
  try {
    const file = base64ToFile(source.contentBase64, source.filename, source.mimeType);
    setFileValue(input, file);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `${key} (file decode failed: ${msg})` };
  }
}

function fillMultiCheckboxField(
  key: string,
  def: MultiCheckboxFieldDef,
  values: string[],
): { ok: true } | { ok: false; reason: string } {
  const container = findCheckboxGroup(def.labelPatterns);
  if (!container) {
    return { ok: false, reason: `${key} (checkbox group not found)` };
  }
  let matched = 0;
  const missed: string[] = [];
  for (const v of values) {
    const cb = findCheckboxByLabel(container, v);
    if (!cb) {
      missed.push(v);
      continue;
    }
    setCheckboxChecked(cb, true);
    matched++;
  }
  if (matched === 0) {
    return {
      ok: false,
      reason: `${key} (no checkbox matched: ${values.join(", ")})`,
    };
  }
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
    let result: { ok: true } | { ok: false; reason: string };
    if (def.kind === "multi-checkbox") {
      const values = def.getValues(profile);
      if (!values || values.length === 0) {
        skipped.push(`${key} (no values in profile)`);
        continue;
      }
      result = fillMultiCheckboxField(key, def, values);
    } else if (def.kind === "file") {
      const file = def.getFile(profile);
      if (!file) {
        skipped.push(`${key} (no file in profile)`);
        continue;
      }
      result = fillFileField(key, def, file);
    } else {
      const value = def.getValue(profile);
      if (!value) {
        skipped.push(`${key} (no value in profile)`);
        continue;
      }
      result = fillField(key, def, value);
    }
    if (result.ok) {
      fields.push(key);
    } else {
      skipped.push(result.reason);
    }
  }
  return { ok: true, filled: fields.length, fields, skipped };
}
