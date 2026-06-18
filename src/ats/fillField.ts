type FillableInput = HTMLInputElement | HTMLTextAreaElement;

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
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
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

export function findMatchingOption(
  select: HTMLSelectElement,
  desired: string,
): HTMLOptionElement | null {
  const target = normalize(desired);
  if (!target) return null;
  const opts = Array.from(select.options).filter(
    (o) => o.value !== "" && o.text.trim() !== "",
  );

  let match = opts.find((o) => normalize(o.text) === target);
  if (match) return match;
  match = opts.find((o) => normalize(o.value) === target);
  if (match) return match;

  const subs = opts.filter((o) => {
    const t = normalize(o.text);
    return t.includes(target) || target.includes(t);
  });
  if (subs.length > 0) {
    subs.sort((a, b) => a.text.length - b.text.length);
    return subs[0];
  }

  const targetTokens = new Set(tokens(desired));
  if (targetTokens.size === 0) return null;
  let best: { opt: HTMLOptionElement; score: number } | null = null;
  for (const o of opts) {
    const optTokens = tokens(o.text);
    if (optTokens.length === 0) continue;
    let overlap = 0;
    for (const t of optTokens) if (targetTokens.has(t)) overlap++;
    if (overlap === 0) continue;
    if (!best || overlap > best.score) best = { opt: o, score: overlap };
  }
  return best ? best.opt : null;
}
