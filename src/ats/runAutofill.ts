import { getProfile } from "../storage/profileStorage";
import type { AutofillResponse } from "../messages";
import type { Education } from "../types/profile";
import {
  base64ToFile,
  findMatchingOption,
  flashFilled,
  setCheckboxChecked,
  setFileValue,
  setReactValue,
  setSelectValue,
} from "./fillField";
import {
  findDropdownTrigger,
  selectFromDropdown,
  selectFromTypeahead,
} from "./dropdown";
import { findControlByLabel, labeledControls, matchesLabel } from "./labels";
import { parseMonthYear } from "./profileHelpers";
import { getFieldMapForHost } from "./fieldMapRegistry";
import { WORKDAY_PAGE_LABELS, detectWorkdayPage } from "./workdayPages";
import type {
  EducationGroupFieldDef,
  EntrySubFieldDef,
  FileFieldDef,
  InputFieldDef,
  MultiCheckboxFieldDef,
  MultiTypeaheadFieldDef,
  SelectFieldDef,
} from "./types";

type Restorer = () => void;

let pendingSnapshot: Restorer[] | null = null;
let lastSnapshot: Restorer[] | null = null;

function pushRestorer(fn: Restorer): void {
  if (pendingSnapshot) pendingSnapshot.push(fn);
}

export function undoLastFill(): { undone: number } {
  if (!lastSnapshot || lastSnapshot.length === 0) {
    return { undone: 0 };
  }
  let undone = 0;
  for (const restore of [...lastSnapshot].reverse()) {
    try {
      restore();
      undone++;
    } catch {
      /* silently skip restorers that throw — page may have changed */
    }
  }
  lastSnapshot = null;
  return { undone };
}

/**
 * `notFound` distinguishes "this control isn't in the DOM" — which on a wizard
 * usually just means we're on a different step — from a real failure like an
 * option that didn't match.
 */
type FillResult =
  | { ok: true }
  | { ok: false; reason: string; notFound?: boolean };

const TEXTUAL_SELECTOR =
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea';

function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (predicate()) {
      resolve(true);
      return;
    }
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      if (predicate()) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      window.setTimeout(poll, 50);
    };
    window.setTimeout(poll, 50);
  });
}

function findBySelectors<T extends Element>(
  selectors: string[] | undefined,
  root: ParentNode,
  accept?: (el: Element) => boolean,
): T | null {
  for (const sel of selectors ?? []) {
    for (const el of Array.from(root.querySelectorAll(sel))) {
      if (accept && !accept(el)) continue;
      return el as unknown as T;
    }
  }
  return null;
}

function findTextualInput(
  selectors: string[] | undefined,
  labelPatterns: RegExp[] | undefined,
  root: ParentNode = document,
): HTMLInputElement | HTMLTextAreaElement | null {
  const direct = findBySelectors<HTMLInputElement | HTMLTextAreaElement>(
    selectors,
    root,
  );
  if (direct) return direct;
  if (!labelPatterns?.length) return null;
  return findControlByLabel<HTMLInputElement | HTMLTextAreaElement>(
    TEXTUAL_SELECTOR,
    labelPatterns,
    root,
  );
}

function fillTextual(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prev = el.value;
  setReactValue(el, value);
  pushRestorer(() => setReactValue(el, prev));
  flashFilled(el);
}

function fillInputField(
  key: string,
  def: InputFieldDef,
  value: string,
  root: ParentNode = document,
): FillResult {
  const el = findTextualInput(def.selectors, def.labelPatterns, root);
  if (!el) return { ok: false, reason: `${key} (field not found)`, notFound: true };
  fillTextual(el, value);
  return { ok: true };
}

async function fillSelectField(
  key: string,
  def: SelectFieldDef,
  value: string,
  root: ParentNode = document,
): Promise<FillResult> {
  const native =
    findBySelectors<HTMLSelectElement>(
      def.selectors,
      root,
      (el) => el instanceof HTMLSelectElement,
    ) ?? findControlByLabel<HTMLSelectElement>("select", def.labelPatterns, root);
  if (native) {
    const option = findMatchingOption(native, value);
    if (!option) {
      return { ok: false, reason: `${key} (no option matched "${value}")` };
    }
    const prev = native.value;
    setSelectValue(native, option.value);
    pushRestorer(() => setSelectValue(native, prev));
    flashFilled(native);
    return { ok: true };
  }

  const trigger = findDropdownTrigger(def.selectors, def.labelPatterns, root);
  if (trigger) {
    const before = (trigger.textContent ?? "").trim();
    const ok = await selectFromDropdown(trigger, value);
    if (ok) {
      /*
       * Workday dropdowns have no restorable `.value` — reopening and picking
       * the previous label is the only way back, and it may no longer be an
       * option. Undo is best-effort here by design.
       */
      pushRestorer(() => {
        if (before) void selectFromDropdown(trigger, before);
      });
      flashFilled(trigger);
      return { ok: true };
    }
    return {
      ok: false,
      reason: `${key} (dropdown: no option matched "${value}")`,
    };
  }
  return { ok: false, reason: `${key} (select not found)`, notFound: true };
}

async function fillMultiTypeaheadField(
  key: string,
  def: MultiTypeaheadFieldDef,
  values: string[],
  root: ParentNode = document,
): Promise<FillResult> {
  const input =
    findBySelectors<HTMLInputElement>(def.selectors, root) ??
    findControlByLabel<HTMLInputElement>(
      'input:not([type="hidden"])',
      def.labelPatterns,
      root,
    );
  if (!input) {
    return { ok: false, reason: `${key} (field not found)`, notFound: true };
  }

  const added: string[] = [];
  const missed: string[] = [];
  for (const value of values) {
    /*
     * Sequential, not parallel: each pick re-renders the prompt list, so two
     * concurrent typeaheads would race for the same DOM node.
     */
    const ok = await selectFromTypeahead(input, value, setReactValue);
    if (ok) added.push(value);
    else missed.push(value);
  }
  if (added.length === 0) {
    return {
      ok: false,
      reason: `${key} (no match for: ${values.slice(0, 5).join(", ")})`,
    };
  }
  /* Clear whatever partial text is left in the box after the last pick. */
  if (input.value.trim() !== "") setReactValue(input, "");
  flashFilled(input);
  if (missed.length > 0) {
    return {
      ok: false,
      reason: `${key} (added ${added.length}, no match for: ${missed
        .slice(0, 5)
        .join(", ")})`,
    };
  }
  return { ok: true };
}

function findCheckboxGroup(
  patterns: RegExp[],
  root: ParentNode = document,
): HTMLElement | null {
  for (const fs of Array.from(root.querySelectorAll("fieldset"))) {
    const legend = fs.querySelector("legend");
    if (matchesLabel((legend?.textContent ?? "").trim(), patterns)) {
      return fs as HTMLElement;
    }
  }
  for (const el of Array.from(
    root.querySelectorAll("label, legend, h2, h3, h4, p, span, div"),
  )) {
    const text = (el.textContent ?? "").trim();
    if (text.length > 200) continue;
    if (!matchesLabel(text, patterns)) continue;
    let container: HTMLElement | null = el.parentElement;
    for (let i = 0; i < 4 && container; i++) {
      if (container.querySelectorAll('input[type="checkbox"]').length >= 2) {
        return container;
      }
      container = container.parentElement;
    }
  }
  return null;
}

function findCheckboxByLabel(
  container: HTMLElement,
  desired: string,
): HTMLInputElement | null {
  const candidates = labeledControls<HTMLInputElement>(
    'input[type="checkbox"]',
    container,
  );
  const target = desired.trim().toLowerCase();
  if (!target) return null;
  const exact = candidates.find((c) => c.label.toLowerCase() === target);
  if (exact) return exact.el;
  const subs = candidates.filter((c) => {
    const t = c.label.toLowerCase();
    return t.includes(target) || target.includes(t);
  });
  if (subs.length > 0) {
    subs.sort((a, b) => a.label.length - b.label.length);
    return subs[0].el;
  }
  return null;
}

function fillMultiCheckboxField(
  key: string,
  def: MultiCheckboxFieldDef,
  values: string[],
): FillResult {
  const container = findCheckboxGroup(def.labelPatterns);
  if (!container) {
    return {
      ok: false,
      reason: `${key} (checkbox group not found)`,
      notFound: true,
    };
  }
  let matched = 0;
  for (const v of values) {
    const cb = findCheckboxByLabel(container, v);
    if (!cb) continue;
    const prev = cb.checked;
    setCheckboxChecked(cb, true);
    pushRestorer(() => setCheckboxChecked(cb, prev));
    flashFilled(cb);
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

function findFileInput(def: FileFieldDef): HTMLInputElement | null {
  const direct = findBySelectors<HTMLInputElement>(
    def.selectors,
    document,
    (el) => el instanceof HTMLInputElement && el.type === "file",
  );
  if (direct) return direct;
  if (!def.labelPatterns?.length) return null;
  const byLabel = findControlByLabel<HTMLInputElement>(
    'input[type="file"]',
    def.labelPatterns,
    document,
  );
  if (byLabel) return byLabel;
  /*
   * File inputs are usually visually hidden behind a styled button and carry no
   * usable label, so fall back to the nearest file input under a matching
   * heading.
   */
  for (const el of Array.from(
    document.querySelectorAll("label, legend, h2, h3, h4, span, div"),
  )) {
    const text = (el.textContent ?? "").trim();
    if (text.length > 120) continue;
    if (!matchesLabel(text, def.labelPatterns)) continue;
    let container: HTMLElement | null = el.parentElement;
    for (let i = 0; i < 4 && container; i++) {
      const file = container.querySelector('input[type="file"]');
      if (file instanceof HTMLInputElement) return file;
      container = container.parentElement;
    }
  }
  return null;
}

function fillFileField(
  key: string,
  def: FileFieldDef,
  source: { contentBase64: string; filename: string; mimeType?: string },
): FillResult {
  const input = findFileInput(def);
  if (!input) {
    return { ok: false, reason: `${key} (file input not found)`, notFound: true };
  }
  try {
    const file = base64ToFile(
      source.contentBase64,
      source.filename,
      source.mimeType,
    );
    const prevFiles = input.files;
    setFileValue(input, file);
    pushRestorer(() => {
      const dt = new DataTransfer();
      if (prevFiles) {
        for (const f of Array.from(prevFiles)) dt.items.add(f);
      }
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    flashFilled(input);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `${key} (file decode failed: ${msg})` };
  }
}

/* ---------- repeating education section ---------- */

function findGroupContainer(def: EducationGroupFieldDef): HTMLElement | null {
  const direct = findBySelectors<HTMLElement>(def.containerSelectors, document);
  if (direct) return direct;
  if (!def.containerHeadingPatterns?.length) return null;
  for (const h of Array.from(
    document.querySelectorAll("h2, h3, h4, legend, [role='heading']"),
  )) {
    const text = (h.textContent ?? "").trim();
    if (text.length > 80) continue;
    if (!matchesLabel(text, def.containerHeadingPatterns)) continue;
    let container: HTMLElement | null = h.parentElement;
    for (let i = 0; i < 5 && container; i++) {
      if (container.querySelector("input, button")) return container;
      container = container.parentElement;
    }
  }
  return null;
}

function findAddButton(
  def: EducationGroupFieldDef,
  container: HTMLElement,
): HTMLElement | null {
  const direct = findBySelectors<HTMLElement>(def.addButtonSelectors, container);
  if (direct) return direct;
  if (!def.addButtonLabelPatterns?.length) return null;
  for (const btn of Array.from(
    container.querySelectorAll<HTMLElement>('button, [role="button"]'),
  )) {
    const text = (btn.textContent ?? "").trim() || (btn.getAttribute("aria-label") ?? "");
    if (matchesLabel(text.trim(), def.addButtonLabelPatterns)) return btn;
  }
  return null;
}

function findPanels(
  def: EducationGroupFieldDef,
  container: HTMLElement,
): HTMLElement[] {
  for (const sel of def.panelSelectors) {
    const found = Array.from(container.querySelectorAll<HTMLElement>(sel));
    if (found.length > 0) return found;
  }
  return [];
}

function fillMonthYear(
  selectors: string[],
  labelPatterns: RegExp[] | undefined,
  raw: string | undefined,
  panel: HTMLElement,
): boolean {
  const parsed = parseMonthYear(raw);
  if (!parsed) return false;
  let scope: ParentNode | null = findBySelectors<HTMLElement>(selectors, panel);
  if (!scope && labelPatterns?.length) {
    const yearByLabel = findControlByLabel<HTMLInputElement>(
      TEXTUAL_SELECTOR,
      labelPatterns,
      panel,
    );
    if (yearByLabel) {
      fillTextual(yearByLabel, parsed.year);
      return true;
    }
  }
  if (!scope) scope = panel;
  const year = scope.querySelector<HTMLInputElement>(
    'input[data-automation-id="dateSectionYear-input"], input[data-automation-id*="Year" i]',
  );
  const month = scope.querySelector<HTMLInputElement>(
    'input[data-automation-id="dateSectionMonth-input"], input[data-automation-id*="Month" i]',
  );
  let wrote = false;
  if (month && parsed.month) {
    fillTextual(month, parsed.month);
    wrote = true;
  }
  if (year) {
    fillTextual(year, parsed.year);
    wrote = true;
  }
  return wrote;
}

async function fillSubField(
  sub: EntrySubFieldDef,
  entry: Education,
  panel: HTMLElement,
): Promise<boolean> {
  const value = sub.getValue(entry);
  if (!value) return false;

  if (sub.kind === "month-year") {
    return fillMonthYear(sub.selectors, sub.labelPatterns, value, panel);
  }
  if (sub.kind === "input") {
    const el = findTextualInput(sub.selectors, sub.labelPatterns, panel);
    if (!el) return false;
    fillTextual(el, value);
    return true;
  }
  if (sub.kind === "dropdown") {
    const native =
      findBySelectors<HTMLSelectElement>(
        sub.selectors,
        panel,
        (el) => el instanceof HTMLSelectElement,
      ) ??
      findControlByLabel<HTMLSelectElement>("select", sub.labelPatterns, panel);
    if (native) {
      const option = findMatchingOption(native, value);
      if (!option) return false;
      const prev = native.value;
      setSelectValue(native, option.value);
      pushRestorer(() => setSelectValue(native, prev));
      flashFilled(native);
      return true;
    }
    const trigger = findDropdownTrigger(sub.selectors, sub.labelPatterns, panel);
    if (!trigger) return false;
    const ok = await selectFromDropdown(trigger, value);
    if (ok) flashFilled(trigger);
    return ok;
  }
  /* typeahead */
  const input =
    findBySelectors<HTMLInputElement>(sub.selectors, panel) ??
    findControlByLabel<HTMLInputElement>(
      'input:not([type="hidden"])',
      sub.labelPatterns,
      panel,
    );
  if (!input) return false;
  const ok = await selectFromTypeahead(input, value, setReactValue);
  if (ok) flashFilled(input);
  return ok;
}

async function fillEducationGroup(
  key: string,
  def: EducationGroupFieldDef,
  entries: Education[],
): Promise<FillResult> {
  const container = findGroupContainer(def);
  if (!container) {
    return {
      ok: false,
      reason: `${key} (education section not found)`,
      notFound: true,
    };
  }

  const addButton = findAddButton(def, container);
  let filledEntries = 0;

  for (let i = 0; i < entries.length; i++) {
    let panels = findPanels(def, container);
    if (panels.length <= i) {
      if (!addButton) break;
      const target = i + 1;
      addButton.click();
      const appeared = await waitUntil(
        () => findPanels(def, container).length >= target,
        2000,
      );
      if (!appeared) break;
      panels = findPanels(def, container);
    }
    const panel = panels[i];
    if (!panel) break;

    let wroteAny = false;
    for (const sub of Object.values(def.subFields)) {
      if (await fillSubField(sub, entries[i], panel)) wroteAny = true;
    }
    if (wroteAny) filledEntries++;
  }

  if (filledEntries === 0) {
    return { ok: false, reason: `${key} (no education fields filled)` };
  }
  return { ok: true };
}

/* ---------- saved answers ---------- */

function tokensOf(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function findInputByQuestion(
  question: string,
): HTMLInputElement | HTMLTextAreaElement | null {
  const target = question.trim().toLowerCase();
  if (!target) return null;
  const candidates = labeledControls<HTMLInputElement | HTMLTextAreaElement>(
    TEXTUAL_SELECTOR,
  ).map((c) => ({ el: c.el, label: c.label.toLowerCase() }));

  const exact = candidates.find((c) => c.label === target);
  if (exact) return exact.el;
  const subs = candidates.filter(
    (c) => c.label.includes(target) || target.includes(c.label),
  );
  if (subs.length > 0) {
    subs.sort((a, b) => a.label.length - b.label.length);
    return subs[0].el;
  }
  const targetTokens = new Set(tokensOf(target));
  if (targetTokens.size === 0) return null;
  let best: {
    el: HTMLInputElement | HTMLTextAreaElement;
    score: number;
  } | null = null;
  for (const c of candidates) {
    const labelTokens = tokensOf(c.label);
    if (labelTokens.length === 0) continue;
    let overlap = 0;
    for (const t of labelTokens) if (targetTokens.has(t)) overlap++;
    if (overlap === 0) continue;
    if (overlap / targetTokens.size < 0.5) continue;
    if (!best || overlap > best.score) best = { el: c.el, score: overlap };
  }
  return best ? best.el : null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.substring(0, max - 1) + "…";
}

function scanUnmatchedQuestions(
  existingAnswers: { question: string }[],
  filledByAnswer: Set<HTMLTextAreaElement | HTMLInputElement>,
): string[] {
  const existingQs = existingAnswers.map((a) =>
    a.question.trim().toLowerCase(),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { el, label } of labeledControls<HTMLTextAreaElement>("textarea")) {
    if (filledByAnswer.has(el)) continue;
    if (el.value.trim() !== "") continue;
    if (label.length < 10 || label.length > 300) continue;
    const lower = label.toLowerCase();
    if (existingQs.some((q) => q === lower || lower.includes(q))) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(label);
    if (out.length >= 5) break;
  }
  return out;
}

/* ---------- orchestration ---------- */

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

  const currentPage = detectWorkdayPage();
  const fields: string[] = [];
  const skipped: string[] = [];
  const offPage: string[] = [];
  pendingSnapshot = [];

  for (const [key, def] of Object.entries(fieldMap)) {
    let result: FillResult;
    if (def.kind === "multi-checkbox") {
      const values = def.getValues(profile);
      if (!values?.length) {
        skipped.push(`${key} (no values in profile)`);
        continue;
      }
      result = fillMultiCheckboxField(key, def, values);
    } else if (def.kind === "multi-typeahead") {
      const values = def.getValues(profile);
      if (!values?.length) {
        skipped.push(`${key} (no values in profile)`);
        continue;
      }
      result = await fillMultiTypeaheadField(key, def, values);
    } else if (def.kind === "education-group") {
      const entries = def.getEntries(profile);
      if (!entries?.length) {
        skipped.push(`${key} (no education in profile)`);
        continue;
      }
      result = await fillEducationGroup(key, def, entries);
    } else if (def.kind === "file") {
      const file = def.getFile(profile);
      if (!file) {
        skipped.push(`${key} (no file in profile)`);
        continue;
      }
      result = fillFileField(key, def, file);
    } else if (def.kind === "select") {
      const value = def.getValue(profile);
      if (!value) {
        skipped.push(`${key} (no value in profile)`);
        continue;
      }
      result = await fillSelectField(key, def, value);
    } else {
      const value = def.getValue(profile);
      if (!value) {
        skipped.push(`${key} (no value in profile)`);
        continue;
      }
      result = fillInputField(key, def, value);
    }

    if (result.ok) {
      fields.push(key);
      continue;
    }
    /*
     * A control that simply isn't in the DOM and belongs to a step we know we're
     * not on is expected, not a failure — report it separately so genuine
     * problems stay visible.
     */
    if (result.notFound && def.page && currentPage && def.page !== currentPage) {
      offPage.push(`${key} (on "${WORKDAY_PAGE_LABELS[def.page]}")`);
    } else {
      skipped.push(result.reason);
    }
  }

  const filledByAnswer = new Set<HTMLTextAreaElement | HTMLInputElement>();
  for (const answer of profile.answers ?? []) {
    const input = findInputByQuestion(answer.question);
    if (!input) continue;
    if (input.value.trim() !== "") continue;
    fillTextual(input, answer.answer);
    filledByAnswer.add(input);
    fields.push(`answer: "${truncate(answer.question, 40)}"`);
  }

  const unmatchedQuestions = scanUnmatchedQuestions(
    profile.answers ?? [],
    filledByAnswer,
  );
  lastSnapshot = pendingSnapshot;
  pendingSnapshot = null;
  return {
    ok: true,
    filled: fields.length,
    fields,
    skipped,
    offPage,
    currentStep: currentPage ? WORKDAY_PAGE_LABELS[currentPage] : undefined,
    unmatchedQuestions,
  };
}
