/**
 * Label resolution for form controls.
 *
 * Greenhouse and Lever use plain `<label for="...">`, so the naive approach of
 * scanning `<label>` elements and following `for` works there. Workday almost
 * never does: it links controls to their label with `aria-labelledby`, and the
 * label lives in a sibling `<div data-automation-id="formField-*">` wrapper.
 *
 * So we invert the search — scan the *controls*, ask each one what its label is
 * through every mechanism in priority order, and match that text against the
 * field map's `labelPatterns`.
 */

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Escapes a value for use inside a double-quoted attribute selector. Only `"`
 * and `\` are special there, so this avoids depending on `CSS.escape` — which is
 * meant for identifiers, not quoted values, and is absent under jsdom.
 */
function escapeAttrValue(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function textOfIds(idList: string): string {
  const texts = idList
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .map(collapse)
    .filter(Boolean);
  return texts.join(" ");
}

/**
 * Best-effort human label for a control, checked in the order that produces the
 * tightest text first. Returns "" when nothing resolves.
 */
export function resolveLabel(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria && collapse(aria)) return collapse(aria);

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = textOfIds(labelledBy);
    if (text) return text;
  }

  if (el.id) {
    const lbl = document.querySelector(
      `label[for="${escapeAttrValue(el.id)}"]`,
    );
    if (lbl) {
      const text = collapse(lbl.textContent ?? "");
      if (text) return text;
    }
  }

  const wrapping = el.closest("label");
  if (wrapping) {
    const text = collapse(wrapping.textContent ?? "");
    if (text) return text;
  }

  const prev = el.previousElementSibling;
  if (prev && (prev.tagName === "LABEL" || prev.tagName === "LEGEND")) {
    const text = collapse(prev.textContent ?? "");
    if (text) return text;
  }

  /*
   * Walk up a few levels looking for the nearest label/legend in the field's
   * own wrapper. Bounded at 4 so we don't climb into a neighbouring field's
   * label on densely nested ATS markup.
   */
  /*
   * Climb looking for a label in this field's own wrapper, but stop as soon as
   * the wrapper holds a control other than this one — at that point we've left
   * the field and anything we find belongs to a sibling.
   *
   * Without that guard this walk reached the <form> and returned the first label
   * on the page: TikTok's unlabelled work-authorization comboboxes all resolved
   * to "Name", which both mismatched them and hid them from the fallback below.
   */
  let container: Element | null = el.parentElement;
  for (let i = 0; i < 4 && container; i++) {
    if (hasForeignControl(container, el)) break;
    const label = container.querySelector("label, legend");
    if (label && !label.contains(el)) {
      const text = collapse(label.textContent ?? "");
      if (text) return text;
    }
    container = container.parentElement;
  }

  return nearbyText(el);
}

const ANY_CONTROL = "input, textarea, select, [role='combobox']";

function hasForeignControl(container: Element, el: Element): boolean {
  for (const other of Array.from(container.querySelectorAll(ANY_CONTROL))) {
    /* A combobox wrapper around `el` is the same field, not a foreign one. */
    if (other !== el && !other.contains(el) && !el.contains(other)) return true;
  }
  return false;
}

/**
 * Last resort: the nearest block of text sitting *before* this control.
 *
 * TikTok's work-authorization questions are `role="combobox"` widgets with no
 * `<label>`, no `aria-label` and no `aria-labelledby` — the question is just a
 * div above them. Every earlier mechanism returns "" there, so the field could
 * never be matched by its question text.
 *
 * A sibling holding its own form control is skipped: that's a neighbouring
 * field, not this one's prompt.
 */
function nearbyText(el: Element): string {
  let node: Element | null = el;
  for (let depth = 0; depth < 4 && node; depth++) {
    let sibling: Element | null = node.previousElementSibling;
    while (sibling) {
      if (!sibling.querySelector("input, textarea, select, [role='combobox']")) {
        const text = collapse(sibling.textContent ?? "");
        /* Long prose is page copy, not a field prompt. */
        if (text.length >= 2 && text.length <= 300) return text;
      }
      sibling = sibling.previousElementSibling;
    }
    node = node.parentElement;
  }
  return "";
}

/**
 * Strips the required-field marker so `/^state$/` matches a "State *" label.
 * Patterns in the field maps already tolerate a trailing `*`, but Workday also
 * emits "(Required)" and non-ASCII asterisks.
 */
function stripRequiredMarker(text: string): string {
  return collapse(
    text
      .replace(/\(\s*required\s*\)/gi, "")
      .replace(/[*∗＊]/g, ""),
  );
}

export function matchesLabel(text: string, patterns: RegExp[]): boolean {
  if (!text) return false;
  if (patterns.some((p) => p.test(text))) return true;
  const stripped = stripRequiredMarker(text);
  return stripped !== text && patterns.some((p) => p.test(stripped));
}

/**
 * A control that opens a menu rather than accepting typed text.
 *
 * These are routinely `readonly` — you pick from the list instead of typing —
 * and rejecting them as unfillable is wrong: clicking is exactly how they're
 * meant to be driven. TikTok's work-authorization questions are readonly
 * `input[role="combobox"]`, which is why they reported "select not found"
 * despite their labels matching.
 */
function isPicker(el: Element): boolean {
  return (
    el.getAttribute("role") === "combobox" || el.hasAttribute("aria-haspopup")
  );
}

function isFillable(el: Element): boolean {
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el instanceof HTMLInputElement) {
    if (el.type === "hidden" || el.disabled) return false;
    return !el.readOnly || isPicker(el);
  }
  if (el instanceof HTMLTextAreaElement) {
    return !el.disabled && !el.readOnly;
  }
  if (el instanceof HTMLSelectElement) {
    return !el.disabled;
  }
  return !(el as HTMLElement).hidden;
}

/**
 * Finds the first control matching `selector` whose resolved label matches one
 * of `patterns`. Scoped to `root` so repeating sections can search one panel.
 */
export function findControlByLabel<T extends Element>(
  selector: string,
  patterns: RegExp[],
  root: ParentNode = document,
): T | null {
  return findControlsByLabel<T>(selector, patterns, root)[0] ?? null;
}

/**
 * Every matching control, in document order.
 *
 * Repeating sections on ATSs that don't wrap each entry in its own panel are
 * disambiguated by position — "the 2nd control labelled Company name in this
 * section" — which needs the whole list, not just the first hit.
 */
export function findControlsByLabel<T extends Element>(
  selector: string,
  patterns: RegExp[],
  root: ParentNode = document,
): T[] {
  if (patterns.length === 0) return [];
  const out: T[] = [];
  for (const el of Array.from(root.querySelectorAll(selector))) {
    if (!isFillable(el)) continue;
    if (matchesLabel(resolveLabel(el), patterns)) out.push(el as unknown as T);
  }
  return out;
}

/**
 * Resolves a matched element to the actual control inside it.
 *
 * Workday's stable hooks sit on *wrappers*: `data-automation-id="formField-school"`
 * is a `<div>` and the real input lives inside it. Passing that div to a value
 * setter throws "Illegal invocation", because the native setter is bound to
 * HTMLInputElement.prototype and a div is not one.
 *
 * Every selector match therefore has to go through here: use it if it already is
 * the control, otherwise reach inside for it.
 */
export function resolveWithin<T extends Element>(
  el: Element | null | undefined,
  selector: string,
): T | null {
  if (!el) return null;
  if (el.matches(selector)) return el as unknown as T;
  return el.querySelector<T>(selector) as T | null;
}

/**
 * Searches from the label *inward*: find text matching `patterns`, then take the
 * first matching control that follows it.
 *
 * The rest of this module searches control-first — ask each control what its
 * label is. That fails when the two are too far apart in the tree, which is
 * exactly what happens to TikTok's work-authorization comboboxes: the `<label>`
 * exists, but enough wrappers sit between it and the `role="combobox"` input
 * that neither the ancestor walk nor `nearbyText` reaches it.
 *
 * Deliberately the last tier tried. It is looser than label resolution — the
 * guard is that the pattern must match and the control must *follow* the label
 * in document order, which is the layout every ATS uses.
 */
export function findControlNearLabel<T extends Element>(
  controlSelector: string,
  patterns: RegExp[],
  root: ParentNode = document,
): T | null {
  if (patterns.length === 0) return null;
  for (const text of Array.from(
    root.querySelectorAll("label, legend, p, span, div"),
  )) {
    const content = collapse(text.textContent ?? "");
    if (!content || content.length > 200) continue;
    if (!matchesLabel(content, patterns)) continue;

    /* Tightest wrapper first, so we don't reach into a sibling question. */
    let container: Element | null = text.parentElement;
    for (let i = 0; i < 4 && container; i++) {
      const following = Array.from(
        container.querySelectorAll<T>(controlSelector),
      ).filter(
        (c) =>
          isFillable(c) &&
          !c.contains(text) &&
          text.compareDocumentPosition(c) &
            Node.DOCUMENT_POSITION_FOLLOWING,
      );
      if (following.length > 0) return following[0];
      container = container.parentElement;
    }
  }
  return null;
}

/** Every control matching `selector`, paired with its resolved label. */
export function labeledControls<T extends Element>(
  selector: string,
  root: ParentNode = document,
): { el: T; label: string }[] {
  const out: { el: T; label: string }[] = [];
  for (const el of Array.from(root.querySelectorAll(selector))) {
    if (!isFillable(el)) continue;
    const label = resolveLabel(el);
    if (!label) continue;
    out.push({ el: el as unknown as T, label });
  }
  return out;
}
