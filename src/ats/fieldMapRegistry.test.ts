import { describe, expect, it } from "vitest";
import manifest from "../../manifest.json";
import {
  SUPPORTED_ATS_LABELS,
  SUPPORTED_HOST_SUFFIXES,
  getAtsLabel,
  getFieldMapForHost,
  isSupportedHost,
} from "./fieldMapRegistry";
import { pickBestOption, pickStrictOption } from "./dropdown";

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

  it("matches TikTok's own careers hosts", () => {
    /* lifeattiktok.com serves the form at the apex, not on a subdomain. */
    expect(getAtsLabel("lifeattiktok.com")).toBe("TikTok");
    expect(getAtsLabel("www.lifeattiktok.com")).toBe("TikTok");
    expect(getAtsLabel("careers.tiktok.com")).toBe("TikTok");
    expect(getFieldMapForHost("lifeattiktok.com")).not.toBeNull();
  });

  it("does not treat the consumer TikTok site as an ATS", () => {
    expect(isSupportedHost("www.tiktok.com")).toBe(false);
    expect(isSupportedHost("tiktok.com")).toBe(false);
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

  /*
   * Captured from a live Workday skills prompt. Searching "Python" returns both
   * of these; plain containment picks the shortest and selects the wrong skill.
   */
  it("prefers a parenthetical-qualified exact match over a shorter prefix match", () => {
    const workday = [
      { text: "Python (Programming Language)" },
      { text: "Python IDLE" },
    ];
    expect(pickBestOption(workday, "Python")?.text).toBe(
      "Python (Programming Language)",
    );
  });

  it("handles qualified matches for symbol-heavy skill names", () => {
    const workday = [
      { text: "C++ (Programming Language)" },
      { text: "C++ Builder" },
    ];
    expect(pickBestOption(workday, "C++")?.text).toBe(
      "C++ (Programming Language)",
    );
  });

  it("still prefers a true exact match over a qualified one", () => {
    const workday = [
      { text: "Java (Programming Language)" },
      { text: "Java" },
    ];
    expect(pickBestOption(workday, "Java")?.text).toBe("Java");
  });
});

/*
 * Every rejection case below is a real wrong skill this added to a live Workday
 * application before the strict matcher existed.
 */
describe("pickStrictOption", () => {
  it("rejects a suffix match: C++ must not become Symbian C++", () => {
    expect(pickStrictOption([{ text: "Symbian C++" }], "C++")).toBeNull();
  });

  it("rejects a suffix match: SQL must not become U-SQL", () => {
    expect(pickStrictOption([{ text: "U-SQL" }], "SQL")).toBeNull();
  });

  it("rejects a glued prefix: Agile must not become AgileZen", () => {
    expect(pickStrictOption([{ text: "AgileZen" }], "Agile")).toBeNull();
  });

  it("picks the qualified entry over a wrong shorter one", () => {
    const opts = [{ text: "Symbian C++" }, { text: "C++ (Programming Language)" }];
    expect(pickStrictOption(opts, "C++")?.text).toBe("C++ (Programming Language)");
  });

  it("accepts a prefix at a real word boundary", () => {
    expect(pickStrictOption([{ text: "Agile Methodology" }], "Agile")?.text).toBe(
      "Agile Methodology",
    );
  });

  it("prefers exact over prefix", () => {
    const opts = [{ text: "React Native" }, { text: "React" }];
    expect(pickStrictOption(opts, "React")?.text).toBe("React");
  });

  it("returns null rather than guessing when nothing is close", () => {
    const opts = [{ text: "Cobol" }, { text: "Fortran" }];
    expect(pickStrictOption(opts, "Rust")).toBeNull();
  });
});

/**
 * The registry is the source of truth for "can we fill this page?", but the
 * manifest is what decides whether a content script is ever injected — and it
 * has to be kept in sync by hand. Adding TikTok to `host_permissions` while
 * forgetting `content_scripts.matches` produced a page the popup claimed to
 * support and could not reach at all.
 */
describe("manifest / registry sync", () => {
  /** Chrome's match-pattern host rules: `*.example.com` also matches the apex. */
  function patternCovers(pattern: string, hostname: string): boolean {
    const host = pattern.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (host.startsWith("*.")) {
      const base = host.slice(2);
      return hostname === base || hostname.endsWith(`.${base}`);
    }
    return hostname === host;
  }

  const contentScriptMatches = manifest.content_scripts.flatMap(
    (cs) => cs.matches,
  );

  it.each(SUPPORTED_HOST_SUFFIXES)(
    "injects a content script on %s",
    (suffix) => {
      expect(
        contentScriptMatches.some((p) => patternCovers(p, suffix)),
      ).toBe(true);
    },
  );

  it.each(SUPPORTED_HOST_SUFFIXES)("grants host permission for %s", (suffix) => {
    expect(
      manifest.host_permissions.some((p) => patternCovers(p, suffix)),
    ).toBe(true);
  });
});
