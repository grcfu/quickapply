import { afterEach, describe, expect, it } from "vitest";
import {
  findControlByLabel,
  findControlNearLabel,
  findControlsByLabel,
  matchesLabel,
  resolveLabel,
  resolveWithin,
} from "./labels";

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

describe("resolveWithin", () => {
  const TEXTUAL = 'input:not([type="hidden"]), textarea';

  /*
   * Workday puts its automation id on the wrapper div, not the input. Returning
   * the div made setReactValue call HTMLInputElement's native value setter on a
   * div, which throws "Illegal invocation" and aborted the whole autofill.
   */
  it("descends from a Workday formField wrapper to the input inside", () => {
    const host = mount(
      '<div data-automation-id="formField-school"><input id="real"></div>',
    );
    const wrapper = host.querySelector<HTMLElement>(
      '[data-automation-id="formField-school"]',
    );
    expect(resolveWithin<HTMLInputElement>(wrapper, TEXTUAL)?.id).toBe("real");
  });

  it("returns the element unchanged when it is already the control", () => {
    const host = mount('<input id="direct">');
    const el = host.querySelector<HTMLInputElement>("#direct");
    expect(resolveWithin<HTMLInputElement>(el, TEXTUAL)?.id).toBe("direct");
  });

  it("finds a textarea inside a wrapper", () => {
    const host = mount(
      '<div data-automation-id="formField-roleDescription"><textarea id="ta"></textarea></div>',
    );
    const wrapper = host.querySelector<HTMLElement>("[data-automation-id]");
    expect(resolveWithin<HTMLTextAreaElement>(wrapper, TEXTUAL)?.id).toBe("ta");
  });

  it("returns null when the wrapper holds no matching control", () => {
    const host = mount('<div data-automation-id="formField-empty"></div>');
    const wrapper = host.querySelector<HTMLElement>("[data-automation-id]");
    expect(resolveWithin(wrapper, TEXTUAL)).toBeNull();
  });

  it("tolerates null input", () => {
    expect(resolveWithin(null, TEXTUAL)).toBeNull();
  });
});

describe("findControlsByLabel", () => {
  /*
   * TikTok repeats "Company name" once per work-experience row with no panel
   * wrapper, so entry N is reached by position within the section.
   */
  it("returns every match in document order", () => {
    document.body.innerHTML = `
      <section id="work">
        <div><label for="c1">Company name</label><input id="c1" /></div>
        <div><label for="t1">Title</label><input id="t1" /></div>
        <div><label for="c2">Company name</label><input id="c2" /></div>
        <div><label for="t2">Title</label><input id="t2" /></div>
      </section>`;
    const matches = findControlsByLabel<HTMLInputElement>(
      "input",
      [/^company name$/i],
      document.getElementById("work")!,
    );
    expect(matches.map((m) => m.id)).toEqual(["c1", "c2"]);
  });

  it("is scoped to the root, so sibling sections don't bleed in", () => {
    document.body.innerHTML = `
      <section id="work">
        <div><label for="c1">Company name</label><input id="c1" /></div>
      </section>
      <section id="intern">
        <div><label for="c2">Company name</label><input id="c2" /></div>
      </section>`;
    const matches = findControlsByLabel<HTMLInputElement>(
      "input",
      [/^company name$/i],
      document.getElementById("intern")!,
    );
    expect(matches.map((m) => m.id)).toEqual(["c2"]);
  });

  it("returns an empty list when nothing matches", () => {
    document.body.innerHTML = `<label for="a">Email</label><input id="a" />`;
    expect(findControlsByLabel("input", [/^company name$/i])).toEqual([]);
  });
});

describe("resolveLabel fallbacks", () => {
  /*
   * TikTok's work-authorization questions: a role="combobox" widget whose
   * question is a plain div above it. No aria-label, no aria-labelledby, no
   * <label for>. Every earlier mechanism returns "".
   */
  it("falls back to the nearest preceding text block", () => {
    document.body.innerHTML = `
      <div class="q">
        <div>Are you legally authorized to work in the US without restriction?</div>
        <div role="combobox" id="c"><input type="search" /></div>
      </div>`;
    expect(resolveLabel(document.getElementById("c")!)).toBe(
      "Are you legally authorized to work in the US without restriction?",
    );
  });

  it("does not borrow a label from a sibling field", () => {
    /*
     * The ancestor walk used to climb to the <form> and return "Name" here,
     * which both mismatched this control and masked the text fallback.
     */
    document.body.innerHTML = `
      <form>
        <div><label for="name">Name</label><input id="name" /></div>
        <div class="q">
          <div>Will you now or in the future require visa sponsorship?</div>
          <div role="combobox" id="c"><input type="search" /></div>
        </div>
      </form>`;
    expect(resolveLabel(document.getElementById("c")!)).toBe(
      "Will you now or in the future require visa sponsorship?",
    );
  });

  it("still reads a label from the field's own wrapper", () => {
    /* The guard must not break the normal Workday case. */
    document.body.innerHTML = `
      <form>
        <div><label>Field of study</label><input id="f" /></div>
        <div><label>Degree</label><input id="d" /></div>
      </form>`;
    expect(resolveLabel(document.getElementById("f")!)).toBe("Field of study");
    expect(resolveLabel(document.getElementById("d")!)).toBe("Degree");
  });

  it("ignores long prose as a label", () => {
    document.body.innerHTML = `
      <div>
        <p>${"a".repeat(400)}</p>
        <div role="combobox" id="c"><input type="search" /></div>
      </div>`;
    expect(resolveLabel(document.getElementById("c")!)).toBe("");
  });
});

describe("readonly pickers", () => {
  /*
   * A combobox search field is routinely readonly — you pick from its menu
   * rather than typing. Treating that as unfillable is what made TikTok's
   * work-authorization questions report "select not found" even though their
   * labels matched.
   */
  it("finds a readonly combobox near its label", () => {
    document.body.innerHTML = `
      <div class="q">
        <label>Are you legally authorized to work in the US without restriction?</label>
        <div class="ud__select"><div class="ud__select__selector">
          <input type="search" role="combobox" readonly />
        </div></div>
      </div>`;
    expect(
      findControlNearLabel<HTMLElement>('[role="combobox"]', [
        /legally authorized to work in the us/i,
      ]),
    ).not.toBeNull();
  });

  it("also accepts a readonly control that only declares aria-haspopup", () => {
    document.body.innerHTML = `
      <div><label for="d">Degree</label><input id="d" readonly aria-haspopup="listbox" /></div>`;
    expect(
      findControlByLabel<HTMLInputElement>("input", [/^degree$/i])?.id,
    ).toBe("d");
  });

  it("still rejects a plain readonly text box", () => {
    /* Not a picker — writing to it would be wrong. */
    document.body.innerHTML = `
      <div><label for="t">Total</label><input id="t" readonly /></div>`;
    expect(findControlByLabel("input", [/^total$/i])).toBeNull();
  });

  it("still rejects disabled pickers", () => {
    document.body.innerHTML = `
      <div><label for="d">Degree</label><input id="d" role="combobox" disabled /></div>`;
    expect(findControlByLabel("input", [/^degree$/i])).toBeNull();
  });
});
