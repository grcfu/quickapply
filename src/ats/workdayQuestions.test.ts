/**
 * jsdom's location.hostname can't be reassigned and runAutofill picks its
 * adapter from it, so this file runs on a Workday URL.
 *
 * @vitest-environment-options { "url": "https://sel.wd1.myworkdayjobs.com/en-US/SEL/job/Apply" }
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "../types/profile";

/**
 * The boilerplate questions every application repeats, in the two shapes they
 * actually arrive in:
 *
 * - **Combined eligibility** — "currently eligible … and will in the future be
 *   eligible … without visa sponsorship" asks about authorization *and*
 *   sponsorship at once, so neither `workAuthUS` nor `sponsorship` can answer
 *   it on its own.
 * - **Company policy agreements** — worded per tenant, so no field map can name
 *   them in advance. They're saved answers, and they render as dropdowns, which
 *   the textual answers pass can't reach.
 */
const profile: Profile = {
  metadata: { createdAt: 0, lastUpdatedAt: 0, version: 1 },
  identity: {
    legalName: { first: "Grace", last: "Fu" },
    workAuth: { authorizedToWorkInUS: true, requiresSponsorship: false },
    demographics: { veteranStatus: "I am not a protected veteran" },
  },
  answers: [
    {
      id: "a1",
      question:
        "If hired, I agree to comply where applicable with SEL's Tobacco, Drug & Alcohol Free Workplace Policies?",
      answer: "Yes",
      createdAt: 0,
    },
  ],
};

/** A labelled native <select>, the shape Workday falls back to on some steps. */
function question(id: string, prompt: string, options: string[]): string {
  return `
    <div class="q">
      <label for="${id}">${prompt}</label>
      <select id="${id}">
        <option value="">Select One</option>
        ${options.map((o) => `<option value="${o}">${o}</option>`).join("")}
      </select>
    </div>`;
}

const ELIGIBILITY =
  "I am currently eligible to work, and will in the future be eligible to work, in the country of this position without visa sponsorship.*";

/* The apostrophe is curly on the page and straight in the saved answer. */
const POLICY =
  "If hired, I agree to comply where applicable with SEL’s Tobacco, Drug &amp; Alcohol Free Workplace Policies?*";

function page(): string {
  return `
    <form>
      ${question("elig", ELIGIBILITY, ["Yes", "No"])}
      ${question("policy", POLICY, ["Yes", "No"])}
      ${question("relative", "Do you have a relative employed by SEL?*", [
        "Yes",
        "No",
      ])}
      ${question("vet", "Veteran Status*", [
        "I identify as one or more of the classifications of a protected veteran",
        "I am not a protected veteran",
      ])}
    </form>`;
}

const valueOf = (id: string) =>
  (document.getElementById(id) as HTMLSelectElement).value;

beforeEach(() => {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async () => ({ quickapply: { schemaVersion: 1, profile } }),
        set: async () => undefined,
      },
    },
  });
  document.body.innerHTML = page();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Workday boilerplate questions", () => {
  it("answers the combined eligibility question from both work-auth flags", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(valueOf("elig")).toBe("Yes");
  });

  it("says No when the same question is asked of someone needing sponsorship", async () => {
    profile.identity!.workAuth = {
      authorizedToWorkInUS: true,
      requiresSponsorship: true,
    };
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(valueOf("elig")).toBe("No");
    profile.identity!.workAuth = {
      authorizedToWorkInUS: true,
      requiresSponsorship: false,
    };
  });

  it("drives a dropdown from a saved answer, curly apostrophe and all", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(valueOf("policy")).toBe("Yes");
  });

  it("leaves an already-answered question alone", async () => {
    const policy = document.getElementById("policy") as HTMLSelectElement;
    policy.value = "No";
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(policy.value).toBe("No");
  });

  /*
   * The saved-answer pass matches on the whole question, not on token overlap:
   * a wrong guess here commits an answer to a compliance question rather than
   * writing visible text the applicant can read and delete.
   */
  it("does not answer an unrelated question", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(valueOf("vet")).toBe("I am not a protected veteran");
    /* Nothing in the profile speaks to this one — it must stay untouched. */
    expect(valueOf("relative")).toBe("");
  });
});
