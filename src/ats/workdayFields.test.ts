import { describe, expect, it } from "vitest";
import { pickBestOption } from "./dropdown";
import { CAREERS_SITE_SOURCES } from "./workdayFields";

const pick = (texts: string[]) =>
  pickBestOption(
    texts.map((text) => ({ text })),
    CAREERS_SITE_SOURCES,
    /* fuzzy */ false,
  )?.text ?? null;

/**
 * "How Did You Hear About Us?" is a real dropdown whose wording changes per
 * tenant, so the guard is behavioural: given a plausible option list, does the
 * candidate list land on the option with "website" in it?
 */
describe("CAREERS_SITE_SOURCES", () => {
  it.each([
    ["Employee Referral", "Company Website", "LinkedIn"],
    ["Job Board", "Careers Website", "Career Fair"],
    ["Employer Website", "Indeed", "University Recruiting"],
    ["Recruiting Website (Third Party)", "Employee Referral"],
    ["Company website / careers page", "Glassdoor"],
  ])("picks the website option out of %s", (...options) => {
    expect(pick(options)).toMatch(/website/i);
  });

  it("falls back to a careers-site option when none says website", () => {
    expect(pick(["Employee Referral", "Company Career Site", "Indeed"])).toBe(
      "Company Career Site",
    );
  });

  /*
   * The reverse-containment hazard: "Company" is contained in the candidate
   * "Company Website", and hierarchical tenants list bare categories like it.
   * Leading with "Website" is what keeps the real answer ahead of the category.
   */
  it("prefers a website option over a bare category that merely contains a candidate word", () => {
    expect(pick(["Company", "Company Website", "Referral"])).toBe(
      "Company Website",
    );
  });

  /*
   * The whole point of fuzzy:false — see the field def. A list with no website
   * and no careers site must fill nothing rather than claim a career fair.
   */
  it("returns nothing when no option is a company website", () => {
    expect(pick(["Career Fair", "Employee Referral", "Newspaper Ad"])).toBeNull();
  });
});
