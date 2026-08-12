import { getProfile } from "../storage/profileStorage";
import type { AutofillResponse } from "../messages";
import {
  base64ToFile,
  blurField,
  describeCandidates,
  findMatchingOption,
  flashFilled,
  focusField,
  setCheckboxChecked,
  setFileValue,
  setReactValue,
  setSelectValue,
  toCandidates,
  typeValue,
} from "./fillField";
import {
  TRIGGER_SELECTOR,
  findDropdownTrigger,
  pressEnter,
  realClick,
  setAbortCheck,
  selectFromDropdown,
  selectFromTypeahead,
} from "./dropdown";
import {
  findControlByLabel,
  findControlNearLabel,
  findControlsByLabel,
  labeledControls,
  matchesLabel,
  resolveWithin,
} from "./labels";
import { parseMonthYear } from "./profileHelpers";
import type { MonthYear } from "./profileHelpers";
import { getFieldMapForHost } from "./fieldMapRegistry";
import { WORKDAY_PAGE_LABELS, detectWorkdayPage } from "./workdayPages";
import type {
  EntrySubFieldDef,
  FileFieldDef,
  InputFieldDef,
  MultiCheckboxFieldDef,
  MultiTypeaheadFieldDef,
  RepeatingGroup,
  SelectFieldDef,
} from "./types";

type Restorer = () => void;

let pendingSnapshot: Restorer[] | null = null;
let lastSnapshot: Restorer[] | null = null;

function pushRestorer(fn: Restorer): void {
  if (pendingSnapshot) pendingSnapshot.push(fn);
}

/*
 * Cooperative cancellation. A run can take tens of seconds on Workday — each
 * skill is a separate round trip through the prompt list — so Stop has to take
 * effect mid-run, not just prevent the next one.
 *
 * Whatever was already written to the page stays written; Undo reverts it.
 */
let cancelRequested = false;
let running = false;

export function requestStop(): boolean {
  if (!running) return false;
  cancelRequested = true;
  return true;
}

function stopped(): boolean {
  return cancelRequested;
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
  | {
      ok: false;
      reason: string;
      notFound?: boolean;
      /** Left alone on purpose, not a failure — nothing to report. */
      skipped?: boolean;
    };

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

/** All matches for the first selector in the list that matches anything. */
function selectAllBySelectors<T extends Element>(
  selectors: string[] | undefined,
  root: ParentNode,
): T[] {
  for (const sel of selectors ?? []) {
    const found = Array.from(root.querySelectorAll(sel));
    if (found.length > 0) return found as unknown as T[];
  }
  return [];
}

/**
 * Where one entry of a repeating section lives.
 *
 * Tenants that wrap each entry in a panel give us a real `root` to scope to.
 * Tenants that don't (no `panelSet-Item` in the DOM) force us to disambiguate by
 * position instead: take the Nth match of each field selector. That is safe here
 * because Workday's field wrappers are unique per section — `formField-school`
 * only ever appears under Education — so an index can't stray across sections.
 */
type EntryScope = { root: ParentNode; nth: number };

function findTextualInput(
  selectors: string[] | undefined,
  labelPatterns: RegExp[] | undefined,
  root: ParentNode = document,
): HTMLInputElement | HTMLTextAreaElement | null {
  const matched = findBySelectors<Element>(selectors, root);
  const direct = resolveWithin<HTMLInputElement | HTMLTextAreaElement>(
    matched,
    TEXTUAL_SELECTOR,
  );
  if (direct) return direct;
  if (!labelPatterns?.length) return null;
  return findControlByLabel<HTMLInputElement | HTMLTextAreaElement>(
    TEXTUAL_SELECTOR,
    labelPatterns,
    root,
  );
}

/*
 * The focus/blur bracket is not cosmetic — see focusField in fillField.ts.
 * Workday reads the field into its form model on blur, so without it Submit
 * still saw every one of these as empty.
 */
function fillTextual(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prev = el.value;
  typeValue(el, value);
  pushRestorer(() => {
    typeValue(el, prev);
  });
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

/**
 * Placeholder text a Workday prompt button shows while unanswered. Anything
 * else in the button means a real selection is already sitting there.
 */
const SELECT_PLACEHOLDER = /^(select( one| \.\.\.|…)?|choose( one)?|search)$/i;

function alreadyAnswered(control: HTMLElement): boolean {
  if (control instanceof HTMLSelectElement) return control.value !== "";
  const text = (control.textContent ?? "").replace(/\s+/g, " ").trim();
  return text !== "" && !SELECT_PLACEHOLDER.test(text);
}

/**
 * `skipIfAnswered` is for the saved-answers pass: a stored answer must never
 * overwrite a selection that's already there — either the applicant's own, or
 * one the field map just made from better-typed profile data.
 */
type SelectFillOptions = { skipIfAnswered?: boolean };

async function fillSelectField(
  key: string,
  def: SelectFieldDef,
  value: string | string[],
  root: ParentNode = document,
  opts: SelectFillOptions = {},
): Promise<FillResult> {
  const wanted = describeCandidates(value);
  const fuzzy = def.fuzzy !== false;
  const native =
    findBySelectors<HTMLSelectElement>(
      def.selectors,
      root,
      (el) => el instanceof HTMLSelectElement,
    ) ?? findControlByLabel<HTMLSelectElement>("select", def.labelPatterns, root);
  if (native) {
    if (opts.skipIfAnswered && alreadyAnswered(native)) {
      return { ok: false, reason: `${key} (already answered)`, skipped: true };
    }
    const option = findMatchingOption(native, value, fuzzy);
    if (!option) {
      return { ok: false, reason: `${key} (no option matched "${wanted}")` };
    }
    const prev = native.value;
    focusField(native);
    setSelectValue(native, option.value);
    blurField(native);
    pushRestorer(() => setSelectValue(native, prev));
    flashFilled(native);
    return { ok: true };
  }

  const trigger =
    findDropdownTrigger(def.selectors, def.labelPatterns, root) ??
    findControlNearLabel<HTMLElement>(TRIGGER_SELECTOR, def.labelPatterns, root);
  if (trigger) {
    if (opts.skipIfAnswered && alreadyAnswered(trigger)) {
      return { ok: false, reason: `${key} (already answered)`, skipped: true };
    }
    const before = (trigger.textContent ?? "").trim();
    const ok = await selectFromDropdown(trigger, value, 2000, fuzzy);
    if (ok) {
      /*
       * Workday dropdowns have no restorable `.value` — reopening and picking
       * the previous label is the only way back, and it may no longer be an
       * option. Undo is best-effort here by design.
       */
      pushRestorer(() => {
        if (before) void selectFromDropdown(trigger, before);
      });
      /*
       * Clicking the option commits the *display*, but the trigger keeps focus,
       * and Workday reads a prompt into its form model on blur exactly as it
       * does a text box — so the same bracket that fixed the text fields is
       * needed here. Safe only after the pick: blurring earlier would close the
       * prompt list before an option could be clicked.
       */
      blurField(trigger);
      flashFilled(trigger);
      return { ok: true };
    }
    return {
      ok: false,
      reason: `${key} (dropdown: no option matched "${wanted}")`,
    };
  }

  /*
   * Last tier: a radio group. Yes/No questions are a <select> on Greenhouse and
   * a prompt button on Workday, but TikTok renders them as radios — same
   * "one answer from a fixed set" semantics, different control, so it belongs
   * here rather than as a separate field kind.
   */
  const radio = fillRadioField(key, def, value, root, opts);
  if (radio) return radio;

  /*
   * Name what was actually tried. A bare "select not found" sent us guessing at
   * which of four lookups failed; the counts say immediately whether the label
   * matched nothing or matched something we then couldn't drive.
   */
  const labelHits = def.labelPatterns.length
    ? labeledControls(`select, ${TRIGGER_SELECTOR}, ${RADIO_SELECTOR}`, root).filter(
        (c) => matchesLabel(c.label, def.labelPatterns),
      ).length
    : 0;
  return {
    ok: false,
    reason:
      `${key} (no select/dropdown/radio found — ` +
      `${def.selectors?.length ?? 0} selectors, ${labelHits} label matches)`,
    notFound: true,
  };
}

const RADIO_SELECTOR = 'input[type="radio"]';
const CHECKBOX_SELECTOR = 'input[type="checkbox"]';

/** Null when this isn't a radio group at all, so the caller can keep looking. */
function fillRadioField(
  key: string,
  def: SelectFieldDef,
  value: string | string[],
  root: ParentNode,
  opts: SelectFillOptions = {},
): FillResult | null {
  const container = findOptionGroup(def.labelPatterns, RADIO_SELECTOR, root);
  if (!container) return null;
  const checked = Array.from(
    container.querySelectorAll<HTMLInputElement>(RADIO_SELECTOR),
  ).find((r) => r.checked);
  if (opts.skipIfAnswered && checked) {
    return { ok: false, reason: `${key} (already answered)`, skipped: true };
  }
  const target = findOptionByLabel(container, value, RADIO_SELECTOR);
  if (!target) {
    return {
      ok: false,
      reason: `${key} (no radio matched "${describeCandidates(value)}")`,
    };
  }
  if (target.checked) return { ok: true };
  const previous = checked;
  /*
   * A real click, not a `checked` assignment: radios commit through their click
   * handler, and setting `checked` directly leaves React's group state stale.
   */
  realClick(target);
  pushRestorer(() => {
    if (previous) realClick(previous);
    else setCheckboxChecked(target, false);
  });
  flashFilled(target);
  return { ok: true };
}

async function fillMultiTypeaheadField(
  key: string,
  def: MultiTypeaheadFieldDef,
  values: string[],
  root: ParentNode = document,
): Promise<FillResult> {
  const input =
    resolveWithin<HTMLInputElement>(
      findBySelectors<Element>(def.selectors, root),
      'input:not([type="hidden"])',
    ) ??
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
    if (stopped()) break;
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
  /*
   * Blur once, after the last pick — not inside the loop. The picks themselves
   * must stay unblurred (that would close the prompt list mid-typeahead), but
   * leaving the box focused at the end means Workday never reads the section
   * into its form model, which is the same failure the text fields had.
   */
  blurField(input);
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

/**
 * The wrapper holding a set of related checkboxes or radios, located by the
 * group's own question text. `controlSelector` picks which kind — the shape is
 * identical, only the input type differs.
 */
function findOptionGroup(
  patterns: RegExp[],
  controlSelector: string,
  root: ParentNode = document,
): HTMLElement | null {
  for (const fs of Array.from(root.querySelectorAll("fieldset"))) {
    const legend = fs.querySelector("legend");
    if (
      matchesLabel((legend?.textContent ?? "").trim(), patterns) &&
      fs.querySelector(controlSelector)
    ) {
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
      if (container.querySelectorAll(controlSelector).length >= 2) {
        return container;
      }
      container = container.parentElement;
    }
  }
  return null;
}

function findOptionByLabel(
  container: HTMLElement,
  desired: string | string[],
  controlSelector: string,
): HTMLInputElement | null {
  const controls = labeledControls<HTMLInputElement>(controlSelector, container);
  const targets = toCandidates(desired);
  if (targets.length === 0) return null;
  for (const target of targets) {
    const exact = controls.find((c) => c.label.toLowerCase() === target);
    if (exact) return exact.el;
  }
  for (const target of targets) {
    const subs = controls.filter((c) => {
      const t = c.label.toLowerCase();
      return t.includes(target) || target.includes(t);
    });
    if (subs.length > 0) {
      subs.sort((a, b) => a.label.length - b.label.length);
      return subs[0].el;
    }
  }
  return null;
}

function fillMultiCheckboxField(
  key: string,
  def: MultiCheckboxFieldDef,
  values: string[],
): FillResult {
  const container = findOptionGroup(def.labelPatterns, CHECKBOX_SELECTOR);
  if (!container) {
    return {
      ok: false,
      reason: `${key} (checkbox group not found)`,
      notFound: true,
    };
  }
  let matched = 0;
  for (const v of values) {
    const cb = findOptionByLabel(container, v, CHECKBOX_SELECTOR);
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

/* ---------- repeating sections (education, experience, websites) ---------- */

const ADD_BUTTON_SELECTOR =
  '[data-automation-id="add-button"], [data-automation-id="Add"], [data-automation-id="addButton"]';

/** First selector list among the sub-fields, used to locate the section. */
function anchorSelectors<T>(def: RepeatingGroup<T>): string[] {
  for (const sub of Object.values(def.subFields)) {
    if ("selectors" in sub && sub.selectors?.length) return sub.selectors;
  }
  return [];
}

/** The DOM control a sub-field kind actually writes to. */
function controlSelectorFor<T>(sub: EntrySubFieldDef<T>): string {
  switch (sub.kind) {
    case "checkbox":
      return CHECKBOX_SELECTOR;
    case "file":
      return 'input[type="file"]';
    case "dropdown":
      return `select, ${TRIGGER_SELECTOR}`;
    case "typeahead":
      return 'input:not([type="hidden"])';
    default:
      return TEXTUAL_SELECTOR;
  }
}

/**
 * How many entry rows the section currently holds.
 *
 * Panels when the ATS provides them. Otherwise count occurrences of a single
 * sub-field: three "Company name" inputs means three rows.
 *
 * The label fallback is not optional. A label-driven map like TikTok's has no
 * selectors on most sub-fields, so a selector-only count returned 0 forever —
 * which made the first entry click Add before filling anything, then abort the
 * whole section when no new row appeared.
 */
function countRows<T>(def: RepeatingGroup<T>, container: HTMLElement): number {
  const panels = findPanels(def, container);
  if (panels.length > 0) return panels.length;
  const subs = Object.values(def.subFields);
  for (const sub of subs) {
    if (!("selectors" in sub) || !sub.selectors?.length) continue;
    const n = selectAllBySelectors<HTMLElement>(sub.selectors, container).length;
    if (n > 0) return n;
  }
  for (const sub of subs) {
    if (!sub.labelPatterns?.length) continue;
    const n = findControlsByLabel(
      controlSelectorFor(sub),
      sub.labelPatterns,
      container,
    ).length;
    if (n > 0) return n;
  }
  return 0;
}

/**
 * Locates the section by walking up from one of its own fields.
 *
 * Real Workday tenants often emit no section-level `data-automation-id` at all —
 * no `educationSection`, no `workExperienceSection`. What they do emit is
 * per-field wrappers (`formField-school`), so the reliable move is to find a
 * field we know belongs to this section and climb to the nearest ancestor that
 * also contains an Add button. Nearest matters: climbing too far lands on a
 * container holding several sections' Add buttons, and we'd click the wrong one.
 */
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, legend, [role='heading']";

/*
 * TikTok renders section titles as plain styled divs rather than headings, so
 * generic elements are considered too — but only the innermost element holding
 * the text. Without that, the wrapper div around the entire form has
 * "Work Experience" in its textContent and matches as the section title.
 */
const GENERIC_TITLE_SELECTOR = "div, span, p, strong, label";

function sectionTitles(patterns: RegExp[]): HTMLElement[] {
  const out: HTMLElement[] = [];
  const consider = (el: Element) => {
    const text = (el.textContent ?? "").trim();
    if (!text || text.length > 80) return;
    if (!matchesLabel(text, patterns)) return;
    out.push(el as HTMLElement);
  };
  for (const el of Array.from(document.querySelectorAll(HEADING_SELECTOR))) {
    consider(el);
  }
  for (const el of Array.from(
    document.querySelectorAll(GENERIC_TITLE_SELECTOR),
  )) {
    if (el.querySelector(GENERIC_TITLE_SELECTOR)) continue;
    consider(el);
  }
  return out;
}

/**
 * How many Add buttons this element contains. Exactly one means we've landed on
 * a single repeating section; two or more means we climbed too far and are
 * holding several sections at once.
 */
function countAddButtons<T>(
  def: RepeatingGroup<T>,
  container: HTMLElement,
): number {
  const byId = container.querySelectorAll(ADD_BUTTON_SELECTOR).length;
  if (byId > 0) return byId;
  const patterns = def.addButtonLabelPatterns;
  if (!patterns?.length) return 0;
  let count = 0;
  for (const btn of Array.from(
    container.querySelectorAll<HTMLElement>('button, [role="button"]'),
  )) {
    const text =
      (btn.textContent ?? "").trim() || (btn.getAttribute("aria-label") ?? "");
    if (matchesLabel(text.trim(), patterns)) count++;
  }
  return count;
}

/**
 * Climbs from a section title to the tightest ancestor that holds exactly one
 * repeating section.
 *
 * The one-Add-button rule is what keeps TikTok's "Work Experience" and
 * "Internship Experience" apart. They use identical field labels, so a container
 * spanning both would let the internship entries overwrite the work ones.
 */
function sectionFor<T>(
  def: RepeatingGroup<T>,
  title: HTMLElement,
): HTMLElement | null {
  let fallback: HTMLElement | null = null;
  let container: HTMLElement | null = title.parentElement;
  for (let i = 0; i < 6 && container; i++) {
    if (container.querySelector("input, textarea, button")) {
      if (!fallback) fallback = container;
      if (countAddButtons(def, container) === 1) return container;
    }
    container = container.parentElement;
  }
  return fallback;
}

function findGroupContainer<T>(def: RepeatingGroup<T>): HTMLElement | null {
  const direct = findBySelectors<HTMLElement>(def.containerSelectors, document);
  if (direct) return direct;

  if (def.containerHeadingPatterns?.length) {
    for (const title of sectionTitles(def.containerHeadingPatterns)) {
      const container = sectionFor(def, title);
      if (container) return container;
    }
  }

  const anchor = findBySelectors<HTMLElement>(anchorSelectors(def), document);
  if (!anchor) return null;
  let container: HTMLElement | null = anchor.parentElement;
  for (let i = 0; i < 8 && container; i++) {
    if (container.querySelector(ADD_BUTTON_SELECTOR)) return container;
    container = container.parentElement;
  }
  /* No Add button anywhere above: still usable for filling row 1 in place. */
  return anchor.closest("form") ?? document.body;
}

function findAddButton<T>(
  def: RepeatingGroup<T>,
  container: HTMLElement,
): HTMLElement | null {
  const direct =
    findBySelectors<HTMLElement>(def.addButtonSelectors, container) ??
    container.querySelector<HTMLElement>(ADD_BUTTON_SELECTOR);
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

function findPanels<T>(
  def: RepeatingGroup<T>,
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
  const day = scope.querySelector<HTMLInputElement>(
    'input[data-automation-id="dateSectionDay-input"], input[data-automation-id*="Day" i]',
  );
  let wrote = false;
  if (month && parsed.month) {
    fillTextual(month, parsed.month);
    wrote = true;
  }
  /* Only when the profile actually carries a day — see parseMonthYear. */
  if (day && parsed.day) {
    fillTextual(day, parsed.day);
    wrote = true;
  }
  if (year) {
    fillTextual(year, parsed.year);
    wrote = true;
  }
  return wrote;
}

/**
 * Resolves one sub-field's control inside an entry.
 *
 * Entry 1 takes the first match. Later entries, on ATSs that don't wrap each
 * entry in its own panel, are pinned positionally: the Nth match within the
 * section. Selectors are tried first, then labels — TikTok has no per-field
 * hooks at all, so "the 2nd control labelled Company name" is the only handle
 * on its second work-experience row.
 */
function scopedControl<E extends Element>(
  scope: EntryScope,
  selectors: string[] | undefined,
  labelPatterns: RegExp[] | undefined,
  controlSelector: string,
): E | null {
  const panel = scope.root;
  if (scope.nth === 0) {
    const direct = resolveWithin<E>(
      findBySelectors<Element>(selectors, panel),
      controlSelector,
    );
    if (direct) return direct;
    return labelPatterns?.length
      ? findControlByLabel<E>(controlSelector, labelPatterns, panel)
      : null;
  }
  const bySelector = resolveWithin<E>(
    selectAllBySelectors<Element>(selectors, panel)[scope.nth],
    controlSelector,
  );
  if (bySelector) return bySelector;
  if (!labelPatterns?.length) return null;
  return (
    findControlsByLabel<E>(controlSelector, labelPatterns, panel)[scope.nth] ??
    null
  );
}

/* Encodings a single-input range picker might accept, most likely first. */
const RANGE_SEPARATORS = [" ~ ", " - ", ","];

/** How long to give the component to re-render after a write. */
const RANGE_COMMIT_MS = 200;

function formatMonth(parsed: MonthYear): string | null {
  /* No month means we'd have to invent one; a fabricated date is worse than none. */
  if (!parsed.month) return null;
  return `${parsed.year}-${parsed.month.padStart(2, "0")}`;
}

/**
 * The element whose visible text reveals whether a write landed. The picker's
 * digits live in spans beside the hidden input, so this is the nearest ancestor
 * that actually renders text.
 */
function pickerWrapper(input: HTMLElement): HTMLElement {
  let node: HTMLElement | null = input.parentElement;
  for (let i = 0; i < 4 && node; i++) {
    if ((node.textContent ?? "").trim()) return node;
    node = node.parentElement;
  }
  return input.parentElement ?? input;
}

/**
 * Writes a date range into a single segmented picker, keeping only a write the
 * component demonstrably absorbed.
 *
 * Verification is the whole point. The value format isn't discoverable from the
 * markup, so several encodings are tried; each is checked against the picker's
 * rendered digits and cleared if they didn't change. A picker that ignores every
 * encoding ends up blank and reported as skipped — the same outcome as not
 * trying, and never a date the profile doesn't contain.
 */
async function fillDateRange<T>(
  sub: Extract<EntrySubFieldDef<T>, { kind: "date-range" }>,
  entry: T,
  scope: EntryScope,
): Promise<boolean> {
  const range = sub.getRange(entry);
  const start = parseMonthYear(range?.start);
  if (!start) return false;
  const startText = formatMonth(start);
  if (!startText) return false;

  const end = parseMonthYear(range?.end);
  const endText = end ? formatMonth(end) : null;

  const input = scopedControl<HTMLInputElement>(
    scope,
    sub.selectors,
    sub.labelPatterns,
    TEXTUAL_SELECTOR,
  );
  if (!input) return false;

  const wrapper = pickerWrapper(input);
  const expected = endText ? [start.year, end!.year] : [start.year];
  const landed = () => {
    const text = wrapper.textContent ?? "";
    return expected.every((year) => text.includes(year));
  };
  /* Already correct — nothing to do, and nothing to roll back. */
  if (landed()) return true;

  const candidates = endText
    ? RANGE_SEPARATORS.map((sep) => `${startText}${sep}${endText}`)
    : [startText];

  const previous = input.value;
  for (const candidate of candidates) {
    if (stopped()) break;
    focusField(input);
    setReactValue(input, candidate);
    /* Many pickers only commit the typed text on Enter. */
    pressEnter(input);
    blurField(input);
    /* The component may re-render a tick later. */
    if (await waitUntil(landed, RANGE_COMMIT_MS)) {
      pushRestorer(() => {
        focusField(input);
        setReactValue(input, previous);
        blurField(input);
      });
      flashFilled(input);
      return true;
    }
    /*
     * Our text survived verbatim, so the component never read this input — it
     * isn't parsing the value at all and no other separator will help. Bail
     * instead of paying the timeout once per encoding.
     */
    const untouched = input.value === candidate;
    setReactValue(input, previous);
    if (untouched) break;
  }
  blurField(input);
  return false;
}

async function fillSubField<T>(
  sub: EntrySubFieldDef<T>,
  entry: T,
  scope: EntryScope,
): Promise<boolean> {
  const panel = scope.root;

  if (sub.kind === "date-range") return fillDateRange(sub, entry, scope);

  /*
   * Handled before the getValue branches: a file sub-field carries a blob, not
   * a string, so it has getFile instead.
   */
  if (sub.kind === "file") {
    const source = sub.getFile(entry);
    if (!source) return false;
    const input = scopedControl<HTMLInputElement>(
      scope,
      sub.selectors,
      sub.labelPatterns,
      'input[type="file"]',
    );
    if (!input) return false;
    try {
      const file = base64ToFile(
        source.contentBase64,
        source.filename,
        source.mimeType,
      );
      setFileValue(input, file);
      flashFilled(input);
      return true;
    } catch {
      return false;
    }
  }

  const value = sub.getValue(entry);
  if (!value) return false;

  /*
   * In index mode the field wrapper carries the automation id but the input sits
   * inside it, so resolve the Nth wrapper first and search within it.
   */
  const nthContainer = (selectors: string[] | undefined): ParentNode | null => {
    if (scope.nth === 0) return panel;
    const all = selectAllBySelectors<HTMLElement>(selectors, panel);
    return all[scope.nth] ?? null;
  };

  if (sub.kind === "checkbox") {
    const box = scopedControl<HTMLInputElement>(
      scope,
      sub.selectors,
      sub.labelPatterns,
      CHECKBOX_SELECTOR,
    );
    if (!box || box.checked) return false;
    const prev = box.checked;
    setCheckboxChecked(box, true);
    pushRestorer(() => setCheckboxChecked(box, prev));
    flashFilled(box);
    return true;
  }

  if (sub.kind === "month-year") {
    const root = nthContainer(sub.selectors);
    if (!root) return false;
    return fillMonthYear(
      scope.nth === 0 ? sub.selectors : [],
      sub.labelPatterns,
      value,
      root as HTMLElement,
    );
  }
  if (sub.kind === "input") {
    const el = scopedControl<HTMLInputElement | HTMLTextAreaElement>(
      scope,
      sub.selectors,
      sub.labelPatterns,
      TEXTUAL_SELECTOR,
    );
    if (!el) return false;
    fillTextual(el, value);
    return true;
  }
  if (sub.kind === "dropdown") {
    /*
     * Look for a native <select> before assuming a button-style prompt. The
     * selector usually matches Workday's wrapper div, and Degree renders as a
     * real <select> ("Select One") inside it — without this the trigger path
     * clicked the wrapper and set nothing.
     */
    const native = scopedControl<HTMLSelectElement>(
      scope,
      sub.selectors,
      sub.labelPatterns,
      "select",
    );
    if (native) {
      const option = findMatchingOption(native, value);
      if (!option) return false;
      const prev = native.value;
      setSelectValue(native, option.value);
      blurField(native);
      pushRestorer(() => setSelectValue(native, prev));
      flashFilled(native);
      return true;
    }
    const trigger =
      scopedControl<HTMLElement>(
        scope,
        sub.selectors,
        sub.labelPatterns,
        TRIGGER_SELECTOR,
      ) ??
      (scope.nth === 0
        ? findDropdownTrigger(sub.selectors, sub.labelPatterns, panel)
        : null);
    if (!trigger) return false;
    const ok = await selectFromDropdown(trigger, value);
    if (ok) {
      blurField(trigger);
      flashFilled(trigger);
    }
    return ok;
  }
  /* typeahead */
  const input = scopedControl<HTMLInputElement>(
    scope,
    sub.selectors,
    sub.labelPatterns,
    'input:not([type="hidden"])',
  );
  if (!input) return false;
  const ok = await selectFromTypeahead(input, value, setReactValue);
  if (ok) {
    blurField(input);
    flashFilled(input);
  }
  return ok;
}

async function fillRepeatingGroup<T>(
  key: string,
  def: RepeatingGroup<T>,
  entries: T[],
): Promise<FillResult> {
  const container = findGroupContainer(def);
  if (!container) {
    return {
      ok: false,
      reason: `${key} (section not found)`,
      notFound: true,
    };
  }

  const addButton = findAddButton(def, container);
  let filledEntries = 0;
  let noPanel = false;

  const rowCount = () => countRows(def, container);

  for (let i = 0; i < entries.length; i++) {
    if (stopped()) break;
    if (rowCount() <= i) {
      if (!addButton) {
        noPanel = true;
        break;
      }
      const target = i + 1;
      realClick(addButton);
      const appeared = await waitUntil(() => rowCount() >= target, 2000);
      if (!appeared) {
        noPanel = true;
        break;
      }
    }

    const panels = findPanels(def, container);
    /* Panel wrappers when the tenant provides them, positional index when not. */
    const scope: EntryScope = panels.length > i
      ? { root: panels[i], nth: 0 }
      : { root: container, nth: i };

    let wroteAny = false;
    for (const sub of Object.values(def.subFields)) {
      if (await fillSubField(sub, entries[i], scope)) wroteAny = true;
    }
    if (wroteAny) filledEntries++;
  }

  if (filledEntries === 0) {
    /* Distinguish "couldn't open a panel" from "panel opened, fields missed" —
     * they point at completely different broken selectors. */
    return {
      ok: false,
      reason: noPanel
        ? `${key} (found section but couldn't add an entry — Add button or panel selector wrong)`
        : `${key} (panel opened but no fields matched)`,
    };
  }
  if (filledEntries < entries.length) {
    return {
      ok: false,
      reason: `${key} (filled ${filledEntries} of ${entries.length})`,
    };
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

/**
 * Turns a saved question into a label pattern for the select pass.
 *
 * Deliberately strict — the label must *contain* the whole question. The textual
 * pass can afford `findInputByQuestion`'s token-overlap tier because a wrong
 * guess there is visible text the applicant can read and delete; a wrong guess
 * here silently commits an answer to a compliance question. Whitespace is
 * flexible (the page wraps and indents its prompts), trailing punctuation and
 * the required marker are dropped, and the three apostrophes interchange —
 * "SEL's" is typed straight and rendered curly.
 */
export function questionPattern(question: string): RegExp {
  const core = question.trim().replace(/[\s*?.:!]+$/, "");
  const escaped = core
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/['’‘]/g, "['’‘]")
    .replace(/\s+/g, "\\s+");
  return new RegExp(escaped, "i");
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
  running = false;
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

  cancelRequested = false;
  running = true;
  setAbortCheck(stopped);

  const currentPage = detectWorkdayPage();
  const fields: string[] = [];
  const skipped: string[] = [];
  const offPage: string[] = [];
  pendingSnapshot = [];

  for (const [key, def] of Object.entries(fieldMap)) {
    if (stopped()) break;
    let result: FillResult;
    /*
     * Per-field isolation. Previously a single throw anywhere in the map — a bad
     * selector, a DOM node that vanished mid-run — aborted the entire autofill
     * and left every remaining field unfilled. One broken field should cost one
     * field.
     */
    try {
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
      } else if (
        def.kind === "education-group" ||
        def.kind === "experience-group" ||
        def.kind === "website-group" ||
        def.kind === "certification-group" ||
        def.kind === "project-group" ||
        def.kind === "award-group"
      ) {
        /*
         * Each arm calls the same generic with a *narrowed* def. Passing the
         * union directly would make T infer as the union of entry types, and
         * subFields' getValue is contravariant in its parameter, so that fails
         * under strictFunctionTypes.
         */
        const runGroup = async <T,>(
          group: RepeatingGroup<T>,
        ): Promise<FillResult | null> => {
          const entries = group.getEntries(profile);
          if (!entries?.length) return null;
          return fillRepeatingGroup(key, group, entries);
        };
        const groupResult =
          def.kind === "education-group"
            ? await runGroup(def)
            : def.kind === "experience-group"
              ? await runGroup(def)
              : def.kind === "website-group"
                ? await runGroup(def)
                : def.kind === "certification-group"
                  ? await runGroup(def)
                  : def.kind === "project-group"
                    ? await runGroup(def)
                    : await runGroup(def);
        if (!groupResult) {
          skipped.push(`${key} (nothing in profile)`);
          continue;
        }
        result = groupResult;
      } else if (def.kind === "file") {
        const file = def.getFile(profile);
        if (!file) {
          skipped.push(`${key} (no file in profile)`);
          continue;
        }
        result = fillFileField(key, def, file);
      } else if (def.kind === "select") {
        /* May be a list of acceptable phrasings, so test it after normalizing. */
        const value = def.getValue(profile) ?? [];
        if (toCandidates(value).length === 0) {
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

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const where = err instanceof Error && err.stack
        ? ` @ ${err.stack.split("\n")[1]?.trim() ?? ""}`
        : "";
      skipped.push(`${key} (error: ${msg}${where})`);
      continue;
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
    if (stopped()) break;
    const label = `answer: "${truncate(answer.question, 40)}"`;
    const input = findInputByQuestion(answer.question);
    if (input) {
      if (input.value.trim() !== "") continue;
      fillTextual(input, answer.answer);
      filledByAnswer.add(input);
      fields.push(label);
      continue;
    }
    /*
     * The same question asked as a dropdown or radio group rather than a text
     * box — Workday renders "I agree to comply with …" and "I am eligible to
     * work …" as Yes/No prompts, which the textual pass above can never reach.
     * That's what makes a stored answer able to cover the boilerplate questions
     * every application repeats but no field map can name in advance.
     */
    const result = await fillSelectField(
      label,
      {
        kind: "select",
        labelPatterns: [questionPattern(answer.question)],
        getValue: () => answer.answer,
      },
      answer.answer,
      document,
      { skipIfAnswered: true },
    );
    if (result.ok) fields.push(label);
    else if (!result.notFound && !result.skipped) skipped.push(result.reason);
  }

  const unmatchedQuestions = scanUnmatchedQuestions(
    profile.answers ?? [],
    filledByAnswer,
  );
  lastSnapshot = pendingSnapshot;
  pendingSnapshot = null;
  const wasStopped = cancelRequested;
  running = false;
  cancelRequested = false;
  return {
    ok: true,
    filled: fields.length,
    fields,
    skipped,
    offPage,
    currentStep: currentPage ? WORKDAY_PAGE_LABELS[currentPage] : undefined,
    unmatchedQuestions,
    stopped: wasStopped,
  };
}
