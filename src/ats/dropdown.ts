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

import { findControlByLabel } from "./labels";

const TRIGGER_SELECTOR = [
  'button[aria-haspopup="listbox"]',
  'button[aria-haspopup="true"]',
  'button[aria-haspopup="dialog"]',
  '[role="combobox"]',
].join(", ");

const LIST_SELECTOR = [
  '[role="listbox"]',
  '[data-automation-id="activeListContainer"]',
  '[data-automation-id="promptOptions"]',
].join(", ");

const OPTION_SELECTOR = [
  '[role="option"]',
  '[data-automation-id="promptOption"]',
  '[data-automation-id="promptLeafNode"]',
].join(", ");

export function findDropdownTrigger(
  selectors: string[] | undefined,
  patterns: RegExp[],
  root: ParentNode = document,
): HTMLElement | null {
  for (const sel of selectors ?? []) {
    const el = root.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return findControlByLabel<HTMLElement>(TRIGGER_SELECTOR, patterns, root);
}

function optionText(el: Element): string {
  const label = el.getAttribute("data-automation-label");
  if (label?.trim()) return label.trim();
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function collectOptions(): { el: HTMLElement; text: string }[] {
  const out: { el: HTMLElement; text: string }[] = [];
  const seen = new Set<Element>();
  for (const list of Array.from(document.querySelectorAll(LIST_SELECTOR))) {
    for (const opt of Array.from(
      list.querySelectorAll<HTMLElement>(OPTION_SELECTOR),
    )) {
      if (seen.has(opt)) continue;
      seen.add(opt);
      const text = optionText(opt);
      if (text) out.push({ el: opt, text });
    }
  }
  return out;
}

/**
 * Polls for an option list to appear. A MutationObserver alone isn't enough:
 * Workday sometimes renders the list synchronously before the observer is
 * wired, and sometimes swaps its contents in place afterwards.
 */
function waitForOptions(
  timeoutMs: number,
): Promise<{ el: HTMLElement; text: string }[]> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      const options = collectOptions();
      if (options.length > 0) {
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

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function tokensOf(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

/**
 * Same four-tier fallback as findMatchingOption for `<select>`: exact text,
 * then substring containment (shortest wins), then token overlap.
 */
export function pickBestOption<T extends { text: string }>(
  options: T[],
  desired: string,
): T | null {
  const target = normalize(desired);
  if (!target || options.length === 0) return null;

  const exact = options.find((o) => normalize(o.text) === target);
  if (exact) return exact;

  const subs = options.filter((o) => {
    const t = normalize(o.text);
    return t.includes(target) || target.includes(t);
  });
  if (subs.length > 0) {
    subs.sort((a, b) => a.text.length - b.text.length);
    return subs[0];
  }

  const targetTokens = new Set(tokensOf(desired));
  if (targetTokens.size === 0) return null;
  let best: { opt: T; score: number } | null = null;
  for (const o of options) {
    const optTokens = tokensOf(o.text);
    if (optTokens.length === 0) continue;
    let overlap = 0;
    for (const t of optTokens) if (targetTokens.has(t)) overlap++;
    if (overlap === 0) continue;
    if (!best || overlap > best.score) best = { opt: o, score: overlap };
  }
  return best ? best.opt : null;
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
  desired: string,
  timeoutMs = 2000,
): Promise<boolean> {
  trigger.click();
  const options = await waitForOptions(timeoutMs);
  if (options.length === 0) return false;
  const match = pickBestOption(options, desired);
  if (!match) {
    dismiss(trigger);
    return false;
  }
  match.el.click();
  return true;
}

/**
 * Workday multiselects (Field of Study, Skills) are text inputs that only
 * accept a value picked from the prompt list they open as you type — writing
 * the text alone leaves the field empty on submit.
 */
export async function selectFromTypeahead(
  input: HTMLInputElement,
  desired: string,
  setValue: (el: HTMLInputElement, value: string) => void,
  timeoutMs = 2000,
): Promise<boolean> {
  input.focus();
  setValue(input, desired);
  const options = await waitForOptions(timeoutMs);
  if (options.length === 0) return false;
  const match = pickBestOption(options, desired);
  if (!match) {
    dismiss(input);
    return false;
  }
  match.el.click();
  return true;
}
