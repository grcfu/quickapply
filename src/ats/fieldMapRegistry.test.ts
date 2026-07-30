import { describe, expect, it } from "vitest";
import {
  SUPPORTED_ATS_LABELS,
  getAtsLabel,
  getFieldMapForHost,
  isSupportedHost,
} from "./fieldMapRegistry";
import { pickBestOption } from "./dropdown";

describe("host matching", () => {
  it("matches Workday tenant subdomains on myworkdayjobs.com", () => {
    expect(isSupportedHost("acme.wd1.myworkdayjobs.com")).toBe(true);
    expect(getAtsLabel("acme.wd5.myworkdayjobs.com")).toBe("Workday");
  });

  it("matches the newer myworkdaysite.com Workday domain", () => {
    expect(isSupportedHost("acme.wd3.myworkdaysite.com")).toBe(true);
    expect(getFieldMapForHost("acme.wd3.myworkdaysite.com")).not.toBeNull();
  });

  it("matches Greenhouse and Lever", () => {
    expect(getAtsLabel("boards.greenhouse.io")).toBe("Greenhouse");
    expect(getAtsLabel("jobs.lever.co")).toBe("Lever");
  });

  it("does not claim support for a host with no adapter", () => {
    /* Ashby is in the manifest but has no field map yet. */
    expect(isSupportedHost("jobs.ashbyhq.com")).toBe(false);
    expect(getFieldMapForHost("jobs.ashbyhq.com")).toBeNull();
  });

  it("does not match a lookalike suffix", () => {
    expect(isSupportedHost("notgreenhouse.io")).toBe(false);
    expect(isSupportedHost("myworkdayjobs.com.evil.test")).toBe(false);
  });

  it("exposes each ATS label only once", () => {
    expect(SUPPORTED_ATS_LABELS).toEqual([
      ...new Set(SUPPORTED_ATS_LABELS),
    ]);
    expect(SUPPORTED_ATS_LABELS).toContain("Workday");
  });
});

describe("pickBestOption", () => {
  const opts = [
    { text: "Alabama" },
    { text: "Alaska" },
    { text: "Tennessee" },
    { text: "Texas" },
  ];

  it("prefers an exact match", () => {
    expect(pickBestOption(opts, "Texas")?.text).toBe("Texas");
  });

  it("is case and whitespace insensitive", () => {
    expect(pickBestOption(opts, "  tennessee ")?.text).toBe("Tennessee");
  });

  it("falls back to containment, shortest match winning", () => {
    expect(pickBestOption([{ text: "Alaska" }, { text: "Alabama" }], "Ala")?.text)
      .toBe("Alaska");
  });

  it("returns null for an empty target or empty option list", () => {
    expect(pickBestOption(opts, "")).toBeNull();
    expect(pickBestOption([], "Texas")).toBeNull();
  });

  it("returns null when nothing overlaps", () => {
    expect(pickBestOption(opts, "Ontario")).toBeNull();
  });
});
