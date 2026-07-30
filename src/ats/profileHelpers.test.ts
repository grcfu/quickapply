import { describe, expect, it } from "vitest";
import { parseMonthYear, pickSkills, yesNo } from "./profileHelpers";
import type { Profile } from "../types/profile";

function profile(partial: Partial<Profile>): Profile {
  return {
    metadata: { createdAt: 0, lastUpdatedAt: 0, version: 1 },
    ...partial,
  };
}

describe("yesNo", () => {
  it("maps booleans to Yes/No", () => {
    expect(yesNo(true)).toBe("Yes");
    expect(yesNo(false)).toBe("No");
  });

  it("leaves the question alone when unanswered", () => {
    expect(yesNo(undefined)).toBeUndefined();
  });

  it("treats null as unanswered, not as No", () => {
    /* Imported JSON can carry null; answering "No" here would be wrong. */
    expect(yesNo(null)).toBeUndefined();
  });
});

describe("parseMonthYear", () => {
  it("parses ISO year-month", () => {
    expect(parseMonthYear("2026-05")).toEqual({ year: "2026", month: "5" });
  });

  it("parses month/year", () => {
    expect(parseMonthYear("05/2026")).toEqual({ year: "2026", month: "5" });
  });

  it("parses a written month name", () => {
    expect(parseMonthYear("May 2026")).toEqual({ year: "2026", month: "5" });
  });

  it("parses an abbreviated month name", () => {
    expect(parseMonthYear("Dec 2025")).toEqual({ year: "2025", month: "12" });
  });

  it("parses a bare year with no month", () => {
    expect(parseMonthYear("2026")).toEqual({ year: "2026" });
  });

  it("returns null without a 4-digit year", () => {
    expect(parseMonthYear("May")).toBeNull();
  });

  it("returns null for empty or undefined input", () => {
    expect(parseMonthYear("")).toBeNull();
    expect(parseMonthYear(undefined)).toBeNull();
  });
});

describe("pickSkills", () => {
  it("prefers explicitly curated skills", () => {
    const p = profile({
      skills: ["Python", "React"],
      resumes: [
        {
          id: "1",
          name: "r",
          createdAt: 0,
          updatedAt: 0,
          parsedData: { skills: ["Excel"] },
        },
      ],
    });
    expect(pickSkills(p)).toEqual(["Python", "React"]);
  });

  it("falls back to the default resume's parsed skills", () => {
    const p = profile({
      settings: { defaultResumeId: "b" },
      resumes: [
        {
          id: "a",
          name: "a",
          createdAt: 0,
          updatedAt: 0,
          parsedData: { skills: ["Wrong"] },
        },
        {
          id: "b",
          name: "b",
          createdAt: 0,
          updatedAt: 0,
          parsedData: { skills: ["SQL", "Go"] },
        },
      ],
    });
    expect(pickSkills(p)).toEqual(["SQL", "Go"]);
  });

  it("dedupes case-insensitively and drops blanks", () => {
    const p = profile({ skills: ["Python", "python", "  ", "SQL"] });
    expect(pickSkills(p)).toEqual(["Python", "SQL"]);
  });

  it("returns undefined when there is nothing to fill", () => {
    expect(pickSkills(profile({}))).toBeUndefined();
    expect(pickSkills(profile({ skills: [] }))).toBeUndefined();
  });
});
