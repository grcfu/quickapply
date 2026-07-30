import { afterEach, describe, expect, it } from "vitest";
import { detectWorkdayPage } from "./workdayPages";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

const NO_URL = "https://acme.wd1.myworkdayjobs.com/en-US/careers";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("detectWorkdayPage", () => {
  it("detects My Experience from the education section marker", () => {
    const host = mount('<div data-automation-id="educationSection"></div>');
    expect(detectWorkdayPage(host, NO_URL)).toBe("myExperience");
  });

  it("detects My Information from the legal name section marker", () => {
    const host = mount(
      '<div data-automation-id="legalNameSection"><input></div>',
    );
    expect(detectWorkdayPage(host, NO_URL)).toBe("myInformation");
  });

  it("prefers structural markers over a stale heading", () => {
    const host = mount(`
      <h2>My Information</h2>
      <div data-automation-id="educationSection"></div>
    `);
    expect(detectWorkdayPage(host, NO_URL)).toBe("myExperience");
  });

  it("falls back to the active progress step", () => {
    const host = mount(
      '<li data-automation-id="progressBarActiveStep">Voluntary Disclosures</li>',
    );
    expect(detectWorkdayPage(host, NO_URL)).toBe("disclosures");
  });

  it("falls back to a heading", () => {
    const host = mount("<h2>Application Questions</h2>");
    expect(detectWorkdayPage(host, NO_URL)).toBe("questions");
  });

  it("falls back to the URL when the DOM says nothing", () => {
    const host = mount("<div></div>");
    expect(
      detectWorkdayPage(
        host,
        "https://acme.wd1.myworkdayjobs.com/job/x/apply/myExperience",
      ),
    ).toBe("myExperience");
  });

  it("returns null when the step is genuinely unknown", () => {
    const host = mount("<div><h2>Some Job Title</h2></div>");
    expect(detectWorkdayPage(host, NO_URL)).toBeNull();
  });

  it("ignores headings that are too long to be a step name", () => {
    const host = mount(
      "<h2>My Information is used to process this application</h2>",
    );
    expect(detectWorkdayPage(host, NO_URL)).toBeNull();
  });
});
