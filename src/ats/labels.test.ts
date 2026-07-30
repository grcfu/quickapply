import { afterEach, describe, expect, it } from "vitest";
import { findControlByLabel, matchesLabel, resolveLabel } from "./labels";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("resolveLabel", () => {
  it("prefers aria-label", () => {
    const host = mount('<input aria-label="Postal Code" id="x">');
    const input = host.querySelector("input")!;
    expect(resolveLabel(input)).toBe("Postal Code");
  });

  it("resolves aria-labelledby, which is how Workday labels its inputs", () => {
    const host = mount(`
      <div>
        <label id="lbl-1">State</label>
        <input aria-labelledby="lbl-1">
      </div>
    `);
    const input = host.querySelector("input")!;
    expect(resolveLabel(input)).toBe("State");
  });

  it("joins multiple aria-labelledby ids in order", () => {
    const host = mount(`
      <div>
        <span id="a">Phone</span><span id="b">Number</span>
        <input aria-labelledby="a b">
      </div>
    `);
    expect(resolveLabel(host.querySelector("input")!)).toBe("Phone Number");
  });

  it("falls back to label[for]", () => {
    const host = mount('<label for="e">Email Address</label><input id="e">');
    expect(resolveLabel(host.querySelector("input")!)).toBe("Email Address");
  });

  it("falls back to a wrapping label", () => {
    const host = mount("<label>First Name<input></label>");
    expect(resolveLabel(host.querySelector("input")!)).toBe("First Name");
  });

  it("finds a label in the field wrapper, as Workday nests them", () => {
    const host = mount(`
      <div data-automation-id="formField-city">
        <div><label>City</label></div>
        <div><input data-automation-id="city"></div>
      </div>
    `);
    expect(resolveLabel(host.querySelector("input")!)).toBe("City");
  });

  it("collapses whitespace in resolved text", () => {
    const host = mount(
      '<label for="z">  Address   Line\n  1 </label><input id="z">',
    );
    expect(resolveLabel(host.querySelector("input")!)).toBe("Address Line 1");
  });

  it("returns empty string when nothing resolves", () => {
    const host = mount("<div><input></div>");
    expect(resolveLabel(host.querySelector("input")!)).toBe("");
  });
});

describe("matchesLabel", () => {
  it("matches a plain label", () => {
    expect(matchesLabel("City", [/^city$/i])).toBe(true);
  });

  it("matches through a required-marker asterisk", () => {
    expect(matchesLabel("State *", [/^state$/i])).toBe(true);
  });

  it("matches through a (Required) suffix", () => {
    expect(matchesLabel("Country (Required)", [/^country$/i])).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesLabel("Cover Letter", [/^city$/i])).toBe(false);
  });

  it("is false for empty text", () => {
    expect(matchesLabel("", [/^city$/i])).toBe(false);
  });
});

describe("findControlByLabel", () => {
  it("finds an input by its aria-labelledby label", () => {
    const host = mount(`
      <div>
        <label id="l1">Postal Code</label>
        <input id="target" aria-labelledby="l1">
      </div>
    `);
    const found = findControlByLabel<HTMLInputElement>(
      "input",
      [/^postal code$/i],
      host,
    );
    expect(found?.id).toBe("target");
  });

  it("skips disabled and hidden controls", () => {
    const host = mount(`
      <div>
        <label for="a">City</label><input id="a" disabled>
        <label for="b">City</label><input id="b">
      </div>
    `);
    const found = findControlByLabel<HTMLInputElement>("input", [/^city$/i], host);
    expect(found?.id).toBe("b");
  });

  it("returns null when no pattern is supplied", () => {
    const host = mount('<label for="a">City</label><input id="a">');
    expect(findControlByLabel("input", [], host)).toBeNull();
  });
});
