import { describe, expect, it } from "vitest";
import { blurField, findMatchingOption, focusField } from "./fillField";

function makeSelect(
  options: { value: string; text: string }[],
): HTMLSelectElement {
  const select = document.createElement("select");
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.text = opt.text;
    select.appendChild(o);
  }
  return select;
}

describe("findMatchingOption", () => {
  it("returns null for empty desired string", () => {
    const select = makeSelect([{ value: "a", text: "Apple" }]);
    expect(findMatchingOption(select, "")).toBeNull();
  });

  it("matches exact text case-insensitively", () => {
    const select = makeSelect([
      { value: "1", text: "Yes" },
      { value: "2", text: "No" },
    ]);
    expect(findMatchingOption(select, "yes")?.value).toBe("1");
  });

  it("matches by value when text doesn't match", () => {
    const select = makeSelect([
      { value: "us_citizen", text: "U.S. Citizen" },
      { value: "permanent_resident", text: "Permanent Resident" },
    ]);
    expect(findMatchingOption(select, "us_citizen")?.value).toBe("us_citizen");
  });

  it("falls back to substring match when no exact hit", () => {
    const select = makeSelect([
      { value: "a", text: "Asian (not Hispanic or Latino)" },
      { value: "b", text: "White (not Hispanic or Latino)" },
    ]);
    expect(findMatchingOption(select, "Asian")?.value).toBe("a");
  });

  it("prefers the shortest matching option among substrings", () => {
    const select = makeSelect([
      {
        value: "a",
        text: "Yes, I have a disability or have had one in the past",
      },
      { value: "b", text: "Yes, I want to answer Yes broadly" },
    ]);
    expect(findMatchingOption(select, "Yes")?.value).toBe("b");
  });

  it("falls back to token-overlap scoring when no substring hit", () => {
    const select = makeSelect([
      { value: "a", text: "I am not a protected veteran" },
      { value: "b", text: "I identify as a protected veteran" },
    ]);
    const match = findMatchingOption(select, "not a veteran");
    expect(match?.value).toBe("a");
  });

  it("returns null when nothing matches", () => {
    const select = makeSelect([
      { value: "a", text: "Apple" },
      { value: "b", text: "Banana" },
    ]);
    expect(findMatchingOption(select, "Zebra")).toBeNull();
  });

  it("ignores options with empty value or text", () => {
    const select = makeSelect([
      { value: "", text: "Select…" },
      { value: "yes", text: "Yes" },
    ]);
    expect(findMatchingOption(select, "Yes")?.value).toBe("yes");
  });
});

describe("focusField / blurField", () => {
  /*
   * The reason these exist at all: Workday reads a field into its form model on
   * blur, so a value written without the focus/blur bracket looked filled on
   * screen but came back "required" on Submit.
   */
  it("emits focus then blur around a real input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const seen: string[] = [];
    for (const type of ["focus", "focusin", "blur", "focusout"]) {
      input.addEventListener(type, () => seen.push(type));
    }

    focusField(input);
    expect(document.activeElement).toBe(input);
    blurField(input);

    expect(seen).toContain("focus");
    expect(seen).toContain("blur");
    expect(document.activeElement).not.toBe(input);
    input.remove();
  });

  it("falls back to synthetic events for a control the browser won't focus", () => {
    /* Detached from the document, so .focus() is a no-op. */
    const input = document.createElement("input");
    const seen: string[] = [];
    input.addEventListener("focus", () => seen.push("focus"));
    input.addEventListener("focusin", () => seen.push("focusin"));
    input.addEventListener("blur", () => seen.push("blur"));
    input.addEventListener("focusout", () => seen.push("focusout"));

    focusField(input);
    blurField(input);

    expect(seen).toEqual(["focus", "focusin", "blur", "focusout"]);
  });

  it("bubbles focusout so a wrapper-level handler sees it", () => {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.appendChild(input);
    document.body.appendChild(wrapper);
    let bubbled = 0;
    wrapper.addEventListener("focusout", () => bubbled++);

    focusField(input);
    blurField(input);

    expect(bubbled).toBe(1);
    wrapper.remove();
  });
});
