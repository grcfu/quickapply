/**
 * Workday-style dropdowns and typeaheads.
 *
 * Workday renders no `<select>` elements. A dropdown is a button (or a
 * `role="combobox"` div) that, when clicked, teleports an option list into a
 * container near the end of `<body>` — so the options are not descendants of
 * the trigger and have to be found globally after the click.
 *
 * Option text lives in `data-automation-label` as often as it does in
 * `textContent`, and the list may be `role="listbox"` or Workday's older
 * `promptOption` markup.
 */

import { toCandidates } from "./fillField";
import { findControlByLabel, resolveWithin } from "./labels";

/**
 * Cooperative cancellation.
 *
 * Every wait in here polls, so honouring a Stop means checking this between
 * polls. Without it, pressing Stop during a skills run would still sit through
 * the remaining 2-second timeout of whatever typeahead was mid-flight.
 */
let shouldAbort: () => boolean = () => false;

export function setAbortCheck(fn: () => boolean): void {
  shouldAbort = fn;
}

export const TRIGGER_SELECTOR = [
  'button[aria-haspopup="listbox"]',
  'button[aria-haspopup="true"]',
  'button[aria-haspopup="dialog"]',
  '[role="combobox"]',
].join(", ");

/*
 * Workday's prompt containers, plus the two design systems TikTok's careers
 * site is built from: `atsx-*` for the application form itself and `ud-*` for
 * the newer widgets (the work-authorization questions). Both teleport their
 * menu to the end of <body> exactly like Workday does.
 */
const LIST_SELECTOR = [
  '[role="listbox"]',
  '[data-automation-id="activeListContainer"]',
  '[data-automation-id="promptOptions"]',
  ".atsx-select-dropdown",
  '[class*="atsx-select-dropdown"]',
  '[class*="ud__select__dropdown"]',
  '[class*="select-dropdown"]',
].join(", ");

const OPTION_SELECTOR = [
  '[role="option"]',
  '[data-automation-id="promptOption"]',
  '[data-automation-id="promptLeafNode"]',
  '[data-automation-id="menuItem"]',
  '[class*="select-dropdown-menu-item"]',
  '[class*="select__option"]',
  "li",
].join(", ");

export function findDropdownTrigger(
  selectors: string[] | undefined,
  patterns: RegExp[],
  root: ParentNode = document,
): HTMLElement | null {
  for (const sel of selectors ?? []) {
    const el = root.querySelector<HTMLElement>(sel);
    if (!el) continue;
    /*
     * Workday's automation id sits on the field wrapper, so descend to the
     * button that actually opens the prompt. Fall back to the wrapper itself:
     * some tenants put the handler there.
     */
    return resolveWithin<HTMLElement>(el, TRIGGER_SELECTOR) ?? el;
  }
  return findControlByLabel<HTMLElement>(TRIGGER_SELECTOR, patterns, root);
}

function optionText(el: Element): string {
  const label = el.getAttribute("data-automation-label");
  if (label?.trim()) return label.trim();
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function collectOptions(): { el: HTMLElement; text: string }[] {
  const found: { el: HTMLElement; text: string }[] = [];
  const seen = new Set<Element>();
  for (const list of Array.from(document.querySelectorAll(LIST_SELECTOR))) {
    for (const opt of Array.from(
      list.querySelectorAll<HTMLElement>(OPTION_SELECTOR),
    )) {
      if (seen.has(opt)) continue;
      seen.add(opt);
      const text = optionText(opt);
      if (text) found.push({ el: opt, text });
    }
  }
  /*
   * Workday emits one row as three nested elements — menuItem wrapping
   * promptLeafNode wrapping promptOption — all with identical text. Keeping all
   * three triples the candidate list and, worse, makes the outermost win, which
   * is a layout wrapper whose click never commits the selection.
   *
   * Keep only elements that contain no other candidate: the innermost node, and
   * the one that actually responds to a click.
   */
  return found.filter(
    (o) => !found.some((other) => other.el !== o.el && o.el.contains(other.el)),
  );
}

type Option = { el: HTMLElement; text: string };

/**
 * Polls for an option list to appear. A MutationObserver alone isn't enough:
 * Workday sometimes renders the list synchronously before the observer is
 * wired, and sometimes swaps its contents in place afterwards.
 */
function waitForOptions(timeoutMs: number): Promise<Option[]> {
  return waitForOptionsWhere(() => true, timeoutMs);
}

function waitForOptionsWhere(
  accept: (options: Option[]) => boolean,
  timeoutMs: number,
): Promise<Option[]> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      if (shouldAbort()) {
        resolve([]);
        return;
      }
      const options = collectOptions();
      if (options.length > 0 && accept(options)) {
        resolve(options);
        return;
      }
      if (Date.now() >= deadline) {
        resolve([]);
        return;
      }
      window.setTimeout(poll, 50);
    };
    poll();
  });
}

/**
 * Types into a control the way a person would.
 *
 * Setting `.value` and firing `input`/`change` is enough for React's onChange,
 * but Workday's typeahead runs its own debounced search off keyboard events —
 * without these it never queries, so no options ever appear and the field stays
 * empty no matter how many values we write into it.
 */
function typeInto(
  input: HTMLInputElement,
  text: string,
  setValue: (el: HTMLInputElement, value: string) => void,
): void {
  input.focus();
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "a", bubbles: true }),
  );
  setValue(input, text);
  input.dispatchEvent(new KeyboardEvent("keyup", { key: "a", bubbles: true }));
}

/**
 * Some Workday tenants search as you type; others only run the lookup when you
 * press Enter, leaving the prompt empty until then.
 *
 * Safe to fire even inside a form: synthetic (untrusted) key events never
 * trigger the browser's default action, so this cannot submit the application.
 */
export function pressEnter(input: HTMLInputElement): void {
  for (const type of ["keydown", "keypress", "keyup"]) {
    input.dispatchEvent(
      new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
}

/**
 * Workday prompt options frequently commit on mousedown rather than click, so a
 * bare `.click()` highlights the row without selecting it.
 */
export function realClick(el: HTMLElement): void {
  const opts = { bubbles: true, cancelable: true, view: window };
  /*
   * Best-effort: PointerEvent isn't constructible in every environment, and a
   * throw here would cost us `el.click()` — the part that actually commits.
   * One unclickable Add button used to fail the whole repeating section.
   */
  const optional = (make: () => Event) => {
    try {
      el.dispatchEvent(make());
    } catch {
      /* Unsupported event type here; the plain click below still lands. */
    }
  };
  optional(() => new PointerEvent("pointerdown", opts));
  optional(() => new MouseEvent("mousedown", opts));
  optional(() => new PointerEvent("pointerup", opts));
  optional(() => new MouseEvent("mouseup", opts));
  el.click();
}

function optionSignature(options: Option[]): string {
  return options.map((o) => o.text).join("|");
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function tokensOf(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

/**
 * Workday's taxonomy qualifies entries in trailing parentheses — "Python
 * (Programming Language)", "React (Web Framework)". Stripping that suffix turns
 * a fuzzy match into an exact one.
 */
function stripQualifier(s: string): string {
  return s.replace(/\s*[([][^)\]]*[)\]]\s*$/, "").trim();
}

/**
 * Tiered fallback: exact text, exact text ignoring a trailing qualifier, then
 * substring containment (shortest wins), then token overlap.
 *
 * The qualifier tier is load-bearing on Workday. Searching "Python" returns both
 * "Python (Programming Language)" and "Python IDLE"; without it, containment
 * picks the shortest match and silently selects Python IDLE.
 *
 * `desired` may be a list of acceptable phrasings — see `toCandidates`. Each
 * tier is tried across the whole list before the next, looser tier starts, so a
 * later candidate's exact hit always beats an earlier candidate's fuzzy one.
 */
export function pickBestOption<T extends { text: string }>(
  options: T[],
  desired: string | string[],
  fuzzy = true,
): T | null {
  const targets = toCandidates(desired);
  if (targets.length === 0 || options.length === 0) return null;
  const shortestFirst = (a: T, b: T) => a.text.length - b.text.length;

  for (const target of targets) {
    const exact = options.find((o) => normalize(o.text) === target);
    if (exact) return exact;

    const qualified = options.filter(
      (o) => normalize(stripQualifier(o.text)) === target,
    );
    if (qualified.length > 0) return qualified.sort(shortestFirst)[0];
  }

  for (const target of targets) {
    const subs = options.filter((o) => {
      const t = normalize(o.text);
      return t.includes(target) || target.includes(t);
    });
    if (subs.length > 0) return subs.sort(shortestFirst)[0];
  }

  /* See findMatchingOption: fuzzy=false refuses to guess past containment. */
  if (!fuzzy) return null;
  for (const target of targets) {
    const targetTokens = new Set(tokensOf(target));
    if (targetTokens.size === 0) continue;
    let best: { opt: T; score: number } | null = null;
    for (const o of options) {
      const optTokens = tokensOf(o.text);
      if (optTokens.length === 0) continue;
      let overlap = 0;
      for (const t of optTokens) if (targetTokens.has(t)) overlap++;
      if (overlap === 0) continue;
      if (!best || overlap > best.score) best = { opt: o, score: overlap };
    }
    if (best) return best.opt;
  }
  return null;
}

function dismiss(trigger: HTMLElement): void {
  trigger.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
    }),
  );
}

/** Opens a dropdown trigger and clicks the option best matching `desired`. */
export async function selectFromDropdown(
  trigger: HTMLElement,
  desired: string | string[],
  timeoutMs = 2000,
  fuzzy = true,
): Promise<boolean> {
  realClick(trigger);
  const options = await waitForOptions(timeoutMs);
  if (options.length === 0) return false;
  const match = pickBestOption(options, desired, fuzzy);
  if (!match) {
    dismiss(trigger);
    return false;
  }
  realClick(match.el);
  return true;
}

/* Characters that end a word, so "Agile" matches "Agile Methodology" but not "AgileZen". */
const WORD_BOUNDARY = /[\s([\-/,:.]/;

function startsAtWordBoundary(optionText: string, target: string): boolean {
  const t = normalize(optionText);
  const q = normalize(target);
  if (!t.startsWith(q)) return false;
  if (t.length === q.length) return true;
  return WORD_BOUNDARY.test(t.charAt(q.length));
}

/**
 * Strict matcher for typeaheads backed by a huge controlled vocabulary, where a
 * wrong pick is worse than no pick.
 *
 * The loose containment tiers in `pickBestOption` are right for a state or
 * yes/no dropdown, but catastrophic against Workday's skill taxonomy: "C++"
 * lands on "Symbian C++", "SQL" on "U-SQL", "Agile" on "AgileZen" — the target
 * appears in the option, and the wrong entry is shorter so it wins.
 *
 * Here the option must equal the target, equal it once a trailing qualifier is
 * stripped, or begin with it at a word boundary. Anything else returns null and
 * the value is skipped rather than guessed.
 */
export function pickStrictOption<T extends { text: string }>(
  options: T[],
  desired: string,
): T | null {
  const target = normalize(desired);
  if (!target || options.length === 0) return null;

  const exact = options.find((o) => normalize(o.text) === target);
  if (exact) return exact;

  const shortestFirst = (a: T, b: T) => a.text.length - b.text.length;

  const qualified = options.filter(
    (o) => normalize(stripQualifier(o.text)) === target,
  );
  if (qualified.length > 0) return qualified.sort(shortestFirst)[0];

  const prefixed = options.filter((o) => startsAtWordBoundary(o.text, target));
  if (prefixed.length > 0) return prefixed.sort(shortestFirst)[0];

  return null;
}

/** Does any option plausibly correspond to what we just typed? */
function hasRelevantOption(options: Option[], desired: string): boolean {
  const target = normalize(desired);
  const probe = target.slice(0, Math.min(target.length, 4));
  return options.some((o) => {
    const t = normalize(o.text);
    return t.includes(probe) || target.includes(t);
  });
}

/**
 * Workday multiselects (Field of Study, Skills) are text inputs that only
 * accept a value picked from the prompt list they open as you type — writing
 * the text alone leaves the field empty on submit.
 *
 * The subtle part is *which* list we read. Workday leaves the previous prompt
 * mounted between entries and often pre-opens a "suggested skills" list before
 * any typing, so grabbing the first list that exists means matching against
 * stale results for the previous skill. We therefore wait for the list to
 * actually refresh for this query before picking, and refuse to click anything
 * unrelated to what we typed.
 */
export async function selectFromTypeahead(
  input: HTMLInputElement,
  desired: string,
  setValue: (el: HTMLInputElement, value: string) => void,
  timeoutMs = 2000,
): Promise<boolean> {
  if (shouldAbort()) return false;
  const before = optionSignature(collectOptions());
  const isFresh = (opts: Option[]) =>
    optionSignature(opts) !== before && hasRelevantOption(opts, desired);

  typeInto(input, desired, setValue);

  /*
   * Give search-as-you-type tenants a short window first, then fall back to
   * Enter for the tenants that only run the lookup on submit. Doing it in this
   * order avoids an Enter keystroke on tenants that don't need one.
   */
  let options = await waitForOptionsWhere(isFresh, 700);
  if (options.length === 0) {
    pressEnter(input);
    options = await waitForOptionsWhere(isFresh, timeoutMs);
  }

  if (options.length === 0) {
    /* Clear the dead query so it can't leak into the next entry. */
    setValue(input, "");
    return false;
  }

  /* Strict: skipping a skill beats silently adding the wrong one. */
  const match = pickStrictOption(options, desired);
  if (!match) {
    setValue(input, "");
    return false;
  }

  realClick(match.el);

  /*
   * Wait for the pick to commit before returning — otherwise the next skill
   * starts typing while Workday is still reconciling, and both are lost.
   * Commit shows up as the prompt list closing or the search box clearing.
   */
  await waitUntil(
    () => collectOptions().length === 0 || input.value.trim() === "",
    1000,
  );
  return true;
}

function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      if (predicate() || shouldAbort()) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      window.setTimeout(poll, 50);
    };
    poll();
  });
}
