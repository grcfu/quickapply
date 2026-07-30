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
  let container: Element | null = el.parentElement;
  for (let i = 0; i < 4 && container; i++) {
    const label = container.querySelector("label, legend");
    if (label && !label.contains(el)) {
      const text = collapse(label.textContent ?? "");
      if (text) return text;
    }
    container = container.parentElement;
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

function isFillable(el: Element): boolean {
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el instanceof HTMLInputElement) {
    return el.type !== "hidden" && !el.disabled && !el.readOnly;
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
  if (patterns.length === 0) return null;
  for (const el of Array.from(root.querySelectorAll(selector))) {
    if (!isFillable(el)) continue;
    if (matchesLabel(resolveLabel(el), patterns)) return el as unknown as T;
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
