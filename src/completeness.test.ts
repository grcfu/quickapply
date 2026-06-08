import { describe, expect, it } from "vitest";
import { computeCompleteness } from "./completeness";
import type { Profile } from "./types/profile";

function p(overrides: Partial<Profile> = {}): Profile {
  return {
    metadata: { createdAt: 0, lastUpdatedAt: 0, version: 1 },
    ...overrides,
  };
}

describe("computeCompleteness", () => {
  it("returns 0% for null profile", () => {
    const r = computeCompleteness(null);
    expect(r.percent).toBe(0);
    expect(r.filled).toBe(0);
    expect(r.total).toBe(10);
  });

  it("returns 0% for empty profile", () => {
    const r = computeCompleteness(p());
    expect(r.percent).toBe(0);
    expect(r.filled).toBe(0);
    expect(r.buckets.every((b) => !b.filled)).toBe(true);
  });

  it("counts name only when both first and last are present", () => {
    const r1 = computeCompleteness(
      p({ identity: { legalName: { first: "Grace" } } }),
    );
    expect(r1.buckets.find((b) => b.key === "name")?.filled).toBe(false);

    const r2 = computeCompleteness(
      p({ identity: { legalName: { first: "Grace", last: "Fu" } } }),
    );
    expect(r2.buckets.find((b) => b.key === "name")?.filled).toBe(true);
  });

  it("counts address when both city and state present", () => {
    const r1 = computeCompleteness(
      p({ identity: { contact: { address: { city: "Nashville" } } } }),
    );
    expect(r1.buckets.find((b) => b.key === "address")?.filled).toBe(false);

    const r2 = computeCompleteness(
      p({
        identity: { contact: { address: { city: "Nashville", state: "TN" } } },
      }),
    );
    expect(r2.buckets.find((b) => b.key === "address")?.filled).toBe(true);
  });

  it("counts workAuth when either citizenship or authorizedToWorkInUS is set", () => {
    const r1 = computeCompleteness(
      p({ identity: { workAuth: { citizenshipStatus: "US Citizen" } } }),
    );
    expect(r1.buckets.find((b) => b.key === "workAuth")?.filled).toBe(true);

    const r2 = computeCompleteness(
      p({ identity: { workAuth: { authorizedToWorkInUS: true } } }),
    );
    expect(r2.buckets.find((b) => b.key === "workAuth")?.filled).toBe(true);

    const r3 = computeCompleteness(
      p({ identity: { workAuth: { authorizedToWorkInUS: false } } }),
    );
    expect(r3.buckets.find((b) => b.key === "workAuth")?.filled).toBe(true);
  });

  it("counts links when any of linkedin/github/portfolio is set", () => {
    const r = computeCompleteness(
      p({ identity: { links: { github: "x" } } }),
    );
    expect(r.buckets.find((b) => b.key === "links")?.filled).toBe(true);
  });

  it("counts education when first entry has a school", () => {
    const r = computeCompleteness(
      p({ identity: { educations: [{ school: "Vanderbilt" }] } }),
    );
    expect(r.buckets.find((b) => b.key === "education")?.filled).toBe(true);
  });

  it("counts resume when at least one is present", () => {
    const r = computeCompleteness(
      p({
        resumes: [
          {
            id: "1",
            name: "x",
            createdAt: 0,
            updatedAt: 0,
          },
        ],
      }),
    );
    expect(r.buckets.find((b) => b.key === "resume")?.filled).toBe(true);
  });

  it("counts answers when at least one is present", () => {
    const r = computeCompleteness(
      p({
        answers: [
          { id: "1", question: "q", answer: "a", createdAt: 0 },
        ],
      }),
    );
    expect(r.buckets.find((b) => b.key === "answers")?.filled).toBe(true);
  });

  it("returns 100% when all buckets are filled", () => {
    const r = computeCompleteness(
      p({
        identity: {
          legalName: { first: "Grace", last: "Fu" },
          contact: {
            email: "g@example.com",
            phone: "555-1234",
            address: { city: "Nashville", state: "TN" },
          },
          workAuth: { citizenshipStatus: "US Citizen" },
          links: { linkedin: "x" },
          educations: [{ school: "Vanderbilt" }],
          demographics: { gender: "x" },
        },
        resumes: [
          { id: "1", name: "x", createdAt: 0, updatedAt: 0 },
        ],
        answers: [
          { id: "1", question: "q", answer: "a", createdAt: 0 },
        ],
      }),
    );
    expect(r.filled).toBe(10);
    expect(r.percent).toBe(100);
  });

  it("rounds percent correctly", () => {
    // 3/10 = 30%
    const r = computeCompleteness(
      p({
        identity: {
          legalName: { first: "G", last: "F" },
          contact: { email: "g@e.com" },
        },
        resumes: [{ id: "1", name: "x", createdAt: 0, updatedAt: 0 }],
      }),
    );
    expect(r.filled).toBe(3);
    expect(r.percent).toBe(30);
  });
});
