import { describe, expect, it } from "vitest";
import { extractFields } from "./extractFields";

describe("extractFields", () => {
  describe("email", () => {
    it("finds a basic email", () => {
      const r = extractFields("Contact: john@example.com");
      expect(r.email).toBe("john@example.com");
    });

    it("handles plus-addressed emails", () => {
      const r = extractFields("Reach me at jane+jobs@company.io");
      expect(r.email).toBe("jane+jobs@company.io");
    });

    it("returns undefined when missing", () => {
      const r = extractFields("No contact info here.");
      expect(r.email).toBeUndefined();
    });
  });

  describe("phone", () => {
    it("matches US format with parens", () => {
      const r = extractFields("Phone: (555) 123-4567");
      expect(r.phone).toContain("555");
    });

    it("matches dashed format", () => {
      const r = extractFields("555-123-4567");
      expect(r.phone).toBe("555-123-4567");
    });

    it("matches international format", () => {
      const r = extractFields("+1 555 123 4567");
      expect(r.phone).toContain("555");
    });
  });

  describe("name", () => {
    it("extracts First Last from the top of the resume", () => {
      const r = extractFields("Grace Fu\nSoftware Engineer\ngrace@example.com");
      expect(r.firstName).toBe("Grace");
      expect(r.lastName).toBe("Fu");
    });

    it("normalizes ALL CAPS names to title case", () => {
      const r = extractFields("GRACE FU\nVanderbilt University");
      expect(r.firstName).toBe("Grace");
      expect(r.lastName).toBe("Fu");
    });

    it("handles three-token names with middle initial", () => {
      const r = extractFields("Grace A Fu");
      expect(r.firstName).toBe("Grace");
      expect(r.lastName).toBe("Fu");
    });

    it("skips lines containing email or digits", () => {
      const r = extractFields(
        "grace@example.com\n555-1234\nGrace Fu\nSoftware Engineer",
      );
      expect(r.firstName).toBe("Grace");
      expect(r.lastName).toBe("Fu");
    });

    it("returns undefined when no name-shaped line in first lines", () => {
      const r = extractFields("12345\nfoo@bar.com\n555-1234");
      expect(r.firstName).toBeUndefined();
    });
  });

  describe("school", () => {
    it("matches <Name> University", () => {
      const r = extractFields("Vanderbilt University, BS Computer Science");
      expect(r.school).toBe("Vanderbilt University");
    });

    it("matches University of <Name>", () => {
      const r = extractFields(
        "Education\nUniversity of California, Berkeley",
      );
      expect(r.school).toContain("University of California");
    });

    it("matches <Name> College", () => {
      const r = extractFields("Williams College, BA");
      expect(r.school).toBe("Williams College");
    });

    it("matches <Name> Institute of Technology", () => {
      const r = extractFields("Georgia Institute of Technology");
      expect(r.school).toBe("Georgia Institute of Technology");
    });

    it("does not cross newlines (regression: 'Education\\nVanderbilt University' → 'Vanderbilt University', not 'Education Vanderbilt University')", () => {
      const r = extractFields("Education\nVanderbilt University, BS CS");
      expect(r.school).toBe("Vanderbilt University");
    });
  });

  describe("gpa", () => {
    it("matches GPA: X.X", () => {
      const r = extractFields("GPA: 3.8");
      expect(r.gpa).toBe("3.8");
    });

    it("matches when followed by /4.0", () => {
      const r = extractFields("GPA: 3.92/4.0");
      expect(r.gpa).toBe("3.92");
    });

    it("is case-insensitive", () => {
      const r = extractFields("gpa 3.5");
      expect(r.gpa).toBe("3.5");
    });
  });

  describe("graduationDate", () => {
    it("matches 'Expected May 2026'", () => {
      const r = extractFields("Expected May 2026");
      expect(r.graduationDate).toBe("May 2026");
    });

    it("matches 'May 2026 (Expected)'", () => {
      const r = extractFields("May 2026 (Expected)");
      expect(r.graduationDate).toBe("May 2026");
    });

    it("matches 'Class of 2026' (year only)", () => {
      const r = extractFields("Class of 2026");
      expect(r.graduationDate).toBe("2026");
    });

    it("matches abbreviated month", () => {
      const r = extractFields("Anticipated: Dec 2026");
      expect(r.graduationDate).toBe("Dec 2026");
    });
  });

  describe("skills", () => {
    it("extracts comma-separated skills after 'Skills:'", () => {
      const r = extractFields("Skills: TypeScript, Python, React\n\nNext section");
      expect(r.skills).toContain("TypeScript");
      expect(r.skills).toContain("Python");
      expect(r.skills).toContain("React");
    });

    it("works with 'Technical Skills'", () => {
      const r = extractFields(
        "Technical Skills: Go, Rust\n\nExperience",
      );
      expect(r.skills).toContain("Go");
      expect(r.skills).toContain("Rust");
    });

    it("dedupes repeated skills", () => {
      const r = extractFields("Skills: Go, Go, Go\n\nNext");
      expect(r.skills?.filter((s) => s === "Go").length).toBe(1);
    });

    it("returns undefined when no skills section", () => {
      const r = extractFields("Just experience and projects here.");
      expect(r.skills).toBeUndefined();
    });
  });

  it("returns an object with all keys undefined for empty input", () => {
    const r = extractFields("");
    expect(r.firstName).toBeUndefined();
    expect(r.lastName).toBeUndefined();
    expect(r.email).toBeUndefined();
    expect(r.phone).toBeUndefined();
    expect(r.school).toBeUndefined();
    expect(r.gpa).toBeUndefined();
    expect(r.graduationDate).toBeUndefined();
    expect(r.skills).toBeUndefined();
  });
});
