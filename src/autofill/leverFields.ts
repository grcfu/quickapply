import type { GreenhouseFieldDef } from "./greenhouseFields";

function fullName(
  first: string | undefined,
  last: string | undefined,
): string | undefined {
  const parts = [first, last].filter((s): s is string => Boolean(s?.trim()));
  if (parts.length === 0) return undefined;
  return parts.join(" ");
}

export const leverFields: Record<string, GreenhouseFieldDef> = {
  name: {
    kind: "input",
    selectors: [
      'input[name="name"]',
      'input[autocomplete="name"]',
    ],
    labelPatterns: [/^full name\*?$/i, /^name\*?$/i],
    getValue: (p) => fullName(p.identity?.legalName?.first, p.identity?.legalName?.last),
  },
  email: {
    kind: "input",
    selectors: [
      'input[name="email"]',
      'input[type="email"]',
      'input[autocomplete="email"]',
    ],
    labelPatterns: [/^email\*?$/i],
    getValue: (p) => p.identity?.contact?.email,
  },
  phone: {
    kind: "input",
    selectors: [
      'input[name="phone"]',
      'input[type="tel"]',
      'input[autocomplete="tel"]',
    ],
    labelPatterns: [/^phone\*?$/i],
    getValue: (p) => p.identity?.contact?.phone,
  },
};
