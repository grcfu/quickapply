type FillableInput = HTMLInputElement | HTMLTextAreaElement;

/**
 * Focus/blur around a write, the way a real edit produces them.
 *
 * Workday captures a field into its own form model on blur, not on input.
 * Writing the value and firing input/change updates React and puts the text on
 * screen, but the value Workday validates when you press Submit is only read
 * out of the field when it loses focus — which is why a form that *looked*
 * completely filled still reported required fields as empty, and why retyping
 * (or pasting over) the same text by hand fixed it: that produced the blur.
 *
 * Native focus()/blur() emit the real focus/focusin and blur/focusout pairs.
 * The synthetic fallback is for controls the browser refuses to focus — offscreen
 * or inside an inert wrapper — where the framework still needs to see the event.
 */
export function focusField(el: HTMLElement): void {
  el.focus();
  if (document.activeElement === el) return;
  el.dispatchEvent(new FocusEvent("focus", { bubbles: false }));
  el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
}

export function blurField(el: HTMLElement): void {
  if (document.activeElement === el) {
    el.blur();
    return;
  }
  el.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
  el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

export function setReactValue(el: FillableInput, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  /*
   * An InputEvent, not a bare Event. Handlers that inspect `inputType`/`data` to
   * distinguish a real edit from a programmatic one ignore a plain Event — and
   * `new Event("input")` is not an InputEvent, so `event.inputType` reads
   * undefined. Falls back where InputEvent isn't constructible (older jsdom).
   */
  let inputEvent: Event;
  try {
    inputEvent = new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value,
    });
  } catch {
    inputEvent = new Event("input", { bubbles: true });
  }
  el.dispatchEvent(inputEvent);
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * The keystroke pair a real edit produces around the value change.
 *
 * Workday's typeahead already needed this (`typeInto` in dropdown.ts) because it
 * drives its search off key events rather than `input`. Its plain text fields
 * appear to gate change-tracking the same way: the value and the focus/blur pair
 * alone left every field on My Information reported as empty at Submit even
 * though the text was on screen.
 *
 * A single pair, not one per character — Workday reads the field's value on
 * blur, so what matters is that a keystroke was seen at all, and per-character
 * events on a long role description would cost seconds.
 */
function keyStroke(el: HTMLElement, types: string[]): void {
  for (const type of types) {
    try {
      el.dispatchEvent(
        new KeyboardEvent(type, { key: "a", bubbles: true, cancelable: true }),
      );
    } catch {
      /* Unsupported here; the value write below still lands. */
    }
  }
}

/**
 * Write a textual value the way a person would: focus, keystroke, value, blur.
 * Every plain text/textarea fill goes through this — see `keyStroke` and
 * `focusField` for why each part is load-bearing.
 */
export function typeValue(el: FillableInput, value: string): void {
  focusField(el);
  keyStroke(el, ["keydown", "keypress"]);
  setReactValue(el, value);
  keyStroke(el, ["keyup"]);
  blurField(el);
}

export function setSelectValue(
  select: HTMLSelectElement,
  optionValue: string,
): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;
  if (setter) {
    setter.call(select, optionValue);
  } else {
    select.value = optionValue;
  }
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export function setCheckboxChecked(
  input: HTMLInputElement,
  checked: boolean,
): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "checked",
  )?.set;
  if (setter) {
    setter.call(input, checked);
  } else {
    input.checked = checked;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function base64ToFile(
  base64: string,
  filename: string,
  mimeType?: string,
): File {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, {
    type: mimeType ?? "application/octet-stream",
  });
}

export function setFileValue(input: HTMLInputElement, file: File): void {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

const FLASH_CLASS = "quickapply-just-filled";
const FLASH_STYLE_ID = "quickapply-flash-styles";
const FLASH_DURATION_MS = 1500;

function ensureFlashStyles(): void {
  if (document.getElementById(FLASH_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = FLASH_STYLE_ID;
  style.textContent = `
    .${FLASH_CLASS} {
      animation: quickapply-flash ${FLASH_DURATION_MS}ms ease-out;
    }
    @keyframes quickapply-flash {
      0% {
        box-shadow:
          0 0 0 2px rgb(253 224 71),
          0 0 0 6px rgb(253 224 71 / 0.45);
      }
      100% {
        box-shadow:
          0 0 0 0 transparent,
          0 0 0 0 transparent;
      }
    }
  `;
  document.documentElement.appendChild(style);
}

export function flashFilled(el: Element | null | undefined): void {
  if (!(el instanceof HTMLElement)) return;
  ensureFlashStyles();
  el.classList.remove(FLASH_CLASS);
  void el.offsetWidth;
  el.classList.add(FLASH_CLASS);
  window.setTimeout(() => {
    el.classList.remove(FLASH_CLASS);
  }, FLASH_DURATION_MS + 50);
}

const TOKEN_RE = /[^a-z0-9]+/;

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(TOKEN_RE)
    .filter((t) => t.length >= 2);
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Normalized, de-duplicated list of acceptable answers, in priority order.
 *
 * A field may have more than one right answer because tenants word the same
 * option differently — "How Did You Hear About Us?" offers "Company Website" on
 * one Workday tenant and "Careers Website" on the next. Every option matcher
 * therefore takes `string | string[]` and runs each *tier* across the whole
 * list before dropping to a looser one: an exact hit on candidate 3 is a better
 * answer than a fuzzy token hit on candidate 1.
 */
export function toCandidates(desired: string | string[]): string[] {
  const list = Array.isArray(desired) ? desired : [desired];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of list) {
    const t = normalize(d ?? "");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** How a candidate list reads in a status message. */
export function describeCandidates(desired: string | string[]): string {
  return toCandidates(desired).join('" / "');
}

export function findMatchingOption(
  select: HTMLSelectElement,
  desired: string | string[],
  fuzzy = true,
): HTMLOptionElement | null {
  const targets = toCandidates(desired);
  if (targets.length === 0) return null;
  const opts = Array.from(select.options).filter(
    (o) => o.value !== "" && o.text.trim() !== "",
  );

  for (const target of targets) {
    const match =
      opts.find((o) => normalize(o.text) === target) ??
      opts.find((o) => normalize(o.value) === target);
    if (match) return match;
  }

  for (const target of targets) {
    const subs = opts.filter((o) => {
      const t = normalize(o.text);
      return t.includes(target) || target.includes(t);
    });
    if (subs.length > 0) {
      subs.sort((a, b) => a.text.length - b.text.length);
      return subs[0];
    }
  }

  /*
   * Token overlap is the loosest tier and the only one that can answer a
   * question with something the profile doesn't say — "Company Career Site"
   * shares "career" with "Career Fair". Fields where a near miss would be a
   * false claim rather than a harmless approximation opt out (see
   * `howDidYouHear`) and are reported unfilled instead.
   */
  if (!fuzzy) return null;
  for (const target of targets) {
    const targetTokens = new Set(tokens(target));
    if (targetTokens.size === 0) continue;
    let best: { opt: HTMLOptionElement; score: number } | null = null;
    for (const o of opts) {
      const optTokens = tokens(o.text);
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
