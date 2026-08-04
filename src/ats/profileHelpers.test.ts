import { describe, expect, it } from "vitest";
import {
  fullName,
  isInternship,
  parseMonthYear,
  pickInternships,
  pickProjects,
  pickSkills,
  pickWorkExperiences,
  projectDescription,
  yesNo,
} from "./profileHelpers";
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

  it("parses a full ISO date into month, day, and year", () => {
    expect(parseMonthYear("2025-06-15")).toEqual({
      year: "2025",
      month: "6",
      day: "15",
    });
  });

  it("parses a US-style MM/DD/YYYY date", () => {
    expect(parseMonthYear("06/15/2025")).toEqual({
      year: "2025",
      month: "6",
      day: "15",
    });
  });

  it("leaves day unset when the source has no day", () => {
    /* Guessing a day would put a fabricated date on a real application. */
    expect(parseMonthYear("2025-06")).toEqual({ year: "2025", month: "6" });
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

describe("fullName", () => {
  it("joins the parts a profile actually has", () => {
    expect(fullName(profile({ identity: { legalName: { first: "Grace", last: "Fu" } } }))).toBe(
      "Grace Fu",
    );
  });

  it("includes a middle name when present", () => {
    const p = profile({
      identity: { legalName: { first: "A", middle: "B", last: "C" } },
    });
    expect(fullName(p)).toBe("A B C");
  });

  it("returns undefined rather than an empty string", () => {
    expect(fullName(profile({}))).toBeUndefined();
    expect(fullName(profile({ identity: { legalName: {} } }))).toBeUndefined();
  });
});

describe("internship routing", () => {
  /*
   * TikTok has separate Work Experience and Internship Experience sections and
   * nothing in the profile says which a role belongs to, so it comes off the title.
   */
  it("recognises intern titles", () => {
    expect(isInternship({ title: "Software Engineer Intern" })).toBe(true);
    expect(isInternship({ title: "AI/ML Software Engineer Intern" })).toBe(true);
    expect(isInternship({ title: "Summer Internship - Backend" })).toBe(true);
    expect(isInternship({ title: "Engineering Co-op" })).toBe(true);
  });

  it("does not match a title that merely contains the letters", () => {
    expect(isInternship({ title: "Internal Tools Engineer" })).toBe(false);
    expect(isInternship({ title: "Founder & Software Engineer" })).toBe(false);
    expect(isInternship({})).toBe(false);
  });

  it("splits experiences into the two sections", () => {
    const p = profile({
      identity: {
        experiences: [
          { company: "Ameribakes", title: "Founder & Software Engineer" },
          { company: "WWT", title: "Software Engineer Intern" },
          { company: "OpsCompanion", title: "Software Engineer Intern" },
        ],
      },
    });
    expect(pickWorkExperiences(p)?.map((e) => e.company)).toEqual(["Ameribakes"]);
    expect(pickInternships(p)?.map((e) => e.company)).toEqual([
      "WWT",
      "OpsCompanion",
    ]);
  });

  it("returns undefined for an empty side so the section is skipped, not failed", () => {
    const p = profile({
      identity: { experiences: [{ title: "Software Engineer Intern" }] },
    });
    expect(pickWorkExperiences(p)).toBeUndefined();
    expect(pickInternships(p)).toHaveLength(1);
  });

  it("falls back to resume-parsed experiences when identity has none", () => {
    const p = profile({
      resumes: [
        {
          id: "a",
          name: "a",
          createdAt: 0,
          updatedAt: 0,
          parsedData: { experiences: [{ company: "Parsed", title: "Engineer" }] },
        },
      ],
    });
    expect(pickWorkExperiences(p)?.map((e) => e.company)).toEqual(["Parsed"]);
  });
});

describe("pickProjects", () => {
  it("reads projects off the default resume", () => {
    const p = profile({
      settings: { defaultResumeId: "b" },
      resumes: [
        { id: "a", name: "a", createdAt: 0, updatedAt: 0, parsedData: { projects: [{ name: "Wrong" }] } },
        { id: "b", name: "b", createdAt: 0, updatedAt: 0, parsedData: { projects: [{ name: "Right" }] } },
      ],
    });
    expect(pickProjects(p)?.map((x) => x.name)).toEqual(["Right"]);
  });

  it("drops entries with nothing to fill", () => {
    const p = profile({
      resumes: [
        {
          id: "a",
          name: "a",
          createdAt: 0,
          updatedAt: 0,
          parsedData: { projects: [{}, { name: "  " }, { url: "https://x.test" }] },
        },
      ],
    });
    expect(pickProjects(p)).toHaveLength(1);
  });

  it("returns undefined when there are none", () => {
    expect(pickProjects(profile({}))).toBeUndefined();
  });
});

describe("projectDescription", () => {
  it("prepends the tech stack, which no ATS field holds", () => {
    expect(
      projectDescription({
        tech: ["Next.js", "FastAPI"],
        description: "A marketplace.",
      }),
    ).toBe("Tech: Next.js, FastAPI\n\nA marketplace.");
  });

  it("omits the prefix when there is no stack", () => {
    expect(projectDescription({ description: "A marketplace." })).toBe(
      "A marketplace.",
    );
  });

  it("returns the stack alone when there is no description", () => {
    expect(projectDescription({ tech: ["Rust"] })).toBe("Tech: Rust");
  });

  it("returns undefined when there is nothing to write", () => {
    /* undefined, not "", so the field is reported skipped rather than filled. */
    expect(projectDescription({})).toBeUndefined();
    expect(projectDescription({ tech: [], description: "  " })).toBeUndefined();
  });
});

describe("pickProjects precedence", () => {
  it("prefers identity.projects over the resume-parsed list", () => {
    const p = profile({
      identity: { projects: [{ name: "Curated" }] },
      resumes: [
        {
          id: "a",
          name: "a",
          createdAt: 0,
          updatedAt: 0,
          parsedData: { projects: [{ name: "Parsed" }] },
        },
      ],
    });
    expect(pickProjects(p)?.map((x) => x.name)).toEqual(["Curated"]);
  });

  it("still falls back to the resume when identity has none", () => {
    const p = profile({
      identity: {},
      resumes: [
        {
          id: "a",
          name: "a",
          createdAt: 0,
          updatedAt: 0,
          parsedData: { projects: [{ name: "Parsed" }] },
        },
      ],
    });
    expect(pickProjects(p)?.map((x) => x.name)).toEqual(["Parsed"]);
  });
});
