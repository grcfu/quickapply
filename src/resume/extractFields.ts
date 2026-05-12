export type ExtractedFields = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  school?: string;
  gpa?: string;
  graduationDate?: string;
  skills?: string[];
};

export function extractFields(text: string): ExtractedFields {
  return {
    ...extractName(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    school: extractSchool(text),
    gpa: extractGpa(text),
    graduationDate: extractGraduationDate(text),
    skills: extractSkills(text),
  };
}

function extractEmail(text: string): string | undefined {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : undefined;
}

function extractPhone(text: string): string | undefined {
  const m = text.match(
    /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
  );
  return m ? m[0].trim() : undefined;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function extractName(text: string): {
  firstName?: string;
  lastName?: string;
} {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const raw of lines.slice(0, 8)) {
    const line = raw.split(/[|•·–—]/)[0].trim();
    if (/[@\d]/.test(line)) continue;
    const tokens = line.split(/\s+/);
    if (tokens.length < 2 || tokens.length > 4) continue;
    if (!tokens.every((t) => /^[A-Za-z][A-Za-z'.-]*$/.test(t))) continue;
    if (!tokens.every((t) => /^[A-Z]/.test(t))) continue;
    return {
      firstName: capitalize(tokens[0]),
      lastName: capitalize(tokens[tokens.length - 1]),
    };
  }
  return {};
}

function extractSchool(text: string): string | undefined {
  const patterns = [
    /\b(University[ \t]+of[ \t]+[A-Z][a-zA-Z]+(?:[,\s]+[A-Z][a-zA-Z]+){0,2})\b/,
    /\b([A-Z][a-zA-Z]+(?:[ \t]+[A-Z][a-zA-Z]+){0,3}[ \t]+University)\b/,
    /\b([A-Z][a-zA-Z]+(?:[ \t]+[A-Z][a-zA-Z]+){0,2}[ \t]+College)\b/,
    /\b([A-Z][a-zA-Z]+(?:[ \t]+[A-Z][a-zA-Z]+){0,2}[ \t]+Institute[ \t]+of[ \t]+Technology)\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].replace(/\s+/g, " ").trim();
  }
  return undefined;
}

function extractGpa(text: string): string | undefined {
  const m = text.match(/GPA[:\s]+(\d\.\d{1,2})/i);
  return m ? m[1] : undefined;
}

function extractGraduationDate(text: string): string | undefined {
  const monthYear =
    "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+(\\d{4})";
  const patterns = [
    new RegExp(`(?:Expected|Anticipated|Graduating)[:\\s]+${monthYear}`, "i"),
    new RegExp(`${monthYear}\\s*\\(?\\s*Expected\\s*\\)?`, "i"),
    /Class\s+of\s+(\d{4})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    if (/^class/i.test(m[0])) return m[1];
    return `${m[1]} ${m[2]}`;
  }
  return undefined;
}

function extractSkills(text: string): string[] | undefined {
  const m = text.match(
    /(?:Technical\s+Skills|Skills)\s*[:\n]+([\s\S]{0,500}?)(?:\n\s*\n|$)/i,
  );
  if (!m) return undefined;
  const tokens = m[1]
    .split(/[,•|\n]+/)
    .map((s) => s.trim().replace(/^[•·\-*•]+/, "").trim())
    .filter((s) => s.length > 0 && s.length < 50 && /^[A-Za-z0-9]/.test(s));
  if (tokens.length === 0) return undefined;
  const unique = Array.from(new Set(tokens));
  return unique.slice(0, 20);
}
