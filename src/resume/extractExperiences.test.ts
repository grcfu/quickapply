import { describe, expect, it } from "vitest";
import { extractExperiences } from "./extractExperiences";

/*
 * Fixtures are written the way `extractTextFromPdf` emits text: one visual line
 * per line, with a right-aligned date range landing on the same line as the
 * header it belongs to.
 */

const SINGLE_LINE = `
Grace Fu
grace@example.com | (555) 123-4567

EDUCATION
Vanderbilt University                                          Nashville, TN
B.S. Computer Science, Class of 2028                                    3.9 GPA

EXPERIENCE
World Wide Technology — Software Engineer Intern    St. Louis, MO   May 2026 – Aug 2026
• Engineered Ask Brett, a RAG-optimized AI agent, cutting triage time in half.
• Shipped an evaluation harness covering 400 prompts.

OpsCompanion — Software Engineer Intern             Remote           May 2025 - Aug 2025
• Architected a local-first image PII redaction pipeline in Rust.

SKILLS
Python, TypeScript, Rust
`;

const TITLE_UNDERNEATH = `
WORK EXPERIENCE
Health XR (DentalTechup LLC)                                    Sept 2025 - May 2026
AI/ML Software Engineer Intern
• Built the HIPAA-compliant data-capture pipeline.

Ameribakes Baking Business                                      March 2024 - May 2025
Founder & Software Engineer
• Scaled a D2C startup to $3,500+ in revenue.

EDUCATION
Vanderbilt University
`;

describe("extractExperiences", () => {
  it("reads company, title, location, and dates off a single-line header", () => {
    const out = extractExperiences(SINGLE_LINE);
    expect(out).toHaveLength(2);
    expect(out?.[0]).toMatchObject({
      company: "World Wide Technology",
      title: "Software Engineer Intern",
      location: "St. Louis, MO",
      startDate: "May 2026",
      endDate: "Aug 2026",
    });
    expect(out?.[1]).toMatchObject({
      company: "OpsCompanion",
      title: "Software Engineer Intern",
      location: "Remote",
      startDate: "May 2025",
      endDate: "Aug 2025",
    });
  });

  it("collects the bullets under an entry as its description", () => {
    const out = extractExperiences(SINGLE_LINE);
    expect(out?.[0].description).toBe(
      "Engineered Ask Brett, a RAG-optimized AI agent, cutting triage time in half.\nShipped an evaluation harness covering 400 prompts.",
    );
    /* Bullets stop at the next entry rather than running to the end. */
    expect(out?.[1].description).toBe(
      "Architected a local-first image PII redaction pipeline in Rust.",
    );
  });

  it("stops at the next section heading", () => {
    /* "Python, TypeScript, Rust" under SKILLS must not become a description. */
    const out = extractExperiences(SINGLE_LINE);
    expect(out?.[1].description).not.toMatch(/Python/);
  });

  it("ignores everything before the experience heading", () => {
    /* "Class of 2028" and the GPA line sit above it and carry no range. */
    const out = extractExperiences(SINGLE_LINE);
    expect(out?.map((e) => e.company)).not.toContain("Vanderbilt University");
  });

  it("picks up a title written on the line below the company", () => {
    const out = extractExperiences(TITLE_UNDERNEATH);
    expect(out).toHaveLength(2);
    expect(out?.[0]).toMatchObject({
      company: "Health XR (DentalTechup LLC)",
      title: "AI/ML Software Engineer Intern",
      startDate: "Sept 2025",
      endDate: "May 2026",
    });
    expect(out?.[0].description).toBe(
      "Built the HIPAA-compliant data-capture pipeline.",
    );
    expect(out?.[1]).toMatchObject({
      company: "Ameribakes Baking Business",
      title: "Founder & Software Engineer",
    });
  });

  it("handles an open-ended role", () => {
    const out = extractExperiences(`
EXPERIENCE
Acme Corp — Backend Engineer                        Jan 2024 – Present
• Owned the billing service.
`);
    expect(out?.[0]).toMatchObject({
      startDate: "Jan 2024",
      endDate: "Present",
    });
  });

  it("accepts numeric and bare-year ranges", () => {
    const out = extractExperiences(`
EXPERIENCE
Acme Corp — Analyst                                  05/2024 - 08/2024
Globex — Research Assistant                          2022 - 2023
`);
    expect(out?.[0]).toMatchObject({ startDate: "05/2024", endDate: "08/2024" });
    expect(out?.[1]).toMatchObject({ startDate: "2022", endDate: "2023" });
  });

  it("reads a header split with the dates on their own line", () => {
    const out = extractExperiences(`
EXPERIENCE
Globex Corporation
May 2025 - August 2025
• Wrote a parser.
`);
    expect(out?.[0]).toMatchObject({
      company: "Globex Corporation",
      startDate: "May 2025",
      endDate: "August 2025",
      description: "Wrote a parser.",
    });
  });

  it("keeps an internship heading's entries", () => {
    /* Student resumes often split work and internships; the two sections feed
     * one list because `isInternship` re-derives the split from the title. */
    const out = extractExperiences(`
WORK EXPERIENCE
Acme Corp — Backend Engineer                         Jan 2024 - Dec 2024

INTERNSHIP EXPERIENCE
Globex — Software Engineer Intern                    May 2023 - Aug 2023
`);
    expect(out?.map((e) => e.company)).toEqual(["Acme Corp", "Globex"]);
  });

  it("does not invent an entry from a lone year", () => {
    /* A graduation year or a project year must not anchor an entry. */
    expect(
      extractExperiences(`
EXPERIENCE
Some prose about a thing that happened in 2024 and was good.
`),
    ).toBeUndefined();
  });

  it("returns undefined when there is no experience section at all", () => {
    expect(
      extractExperiences("EDUCATION\nVanderbilt University\nClass of 2028"),
    ).toBeUndefined();
    expect(extractExperiences("")).toBeUndefined();
  });

  it("drops an entry with neither a company nor a title", () => {
    /* A bare date range with nothing around it is not an entry. */
    expect(
      extractExperiences(`
EXPERIENCE
Jan 2024 - Dec 2024
• A bullet with no employer above it.
`),
    ).toBeUndefined();
  });
});
