/**
 * jsdom's location.hostname can't be reassigned, and runAutofill picks its
 * adapter from it — so the whole file runs on a TikTok URL.
 *
 * @vitest-environment-options { "url": "https://lifeattiktok.com/resume/7662700594251958581/apply" }
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "../types/profile";

/**
 * End-to-end autofill against a synthetic copy of TikTok's application form,
 * built from a dump of the live page (`dumpForm`) rather than from guesswork:
 * `atsx-*` classes, 1-based indexed ids like `education[1].school`, comboboxes
 * that teleport their menu to the end of <body>, and work-authorization
 * questions with no label of any kind.
 *
 * Two things make this adapter risky, and both are covered below. Work,
 * Internship and Project Experience reuse identical field labels ("Title",
 * "Description") with no per-entry panel wrapper. And several "select" fields
 * are searchable comboboxes, so writing text into them leaves them empty on
 * submit.
 *
 * `runAutofill` reads storage on entry, so `chrome.storage.local` is stubbed
 * before the module is imported.
 */

const profile: Profile = {
  metadata: { createdAt: 0, lastUpdatedAt: 0, version: 1 },
  identity: {
    legalName: { first: "Grace", last: "Fu" },
    contact: { email: "gracefu@wustl.edu", phone: "3142290392" },
    links: { linkedin: "https://linkedin.com/in/gracefu", github: "https://github.com/gracefu" },
    workAuth: { authorizedToWorkInUS: true, requiresSponsorship: false },
    educations: [
      {
        school: "Washington University in St. Louis",
        degree: "Bachelor's",
        fieldOfStudy: "Computer Science and Business",
        graduationDate: "2027-05",
      },
    ],
    projects: [
      {
        name: "WashU Pointswap",
        role: "Full-Stack Developer",
        tech: ["Next.js", "TypeScript", "FastAPI", "Supabase", "PostgreSQL"],
        startDate: "2026-03",
        endDate: "2026-04",
        description: "Meal points marketplace; 230+ active students.",
      },
      {
        name: "Redline",
        tech: ["Java", "Spring Boot", "Kafka"],
        startDate: "2026-07",
        endDate: "2026-07",
        description: "Event-driven metric-definition risk scoring.",
      },
    ],
    awards: [
      {
        title: "Congressional App Challenge — 1st Place",
        issuer: "U.S. House of Representatives",
        date: "2024",
        description: "Presented at House of Code in Washington D.C.",
      },
      {
        title: "Full-Tuition Danforth Scholar",
        issuer: "Washington University in St. Louis",
        date: "Class of 2028",
        description: "Full tuition merit scholarship.",
      },
      {
        title: "Dean's List · 4.0 GPA",
        issuer: "Washington University in St. Louis",
        date: "All Semesters",
        description: "Perfect 4.0 across CS & Business coursework.",
      },
    ],
    experiences: [
      {
        company: "Ameribakes Baking Business",
        title: "Founder & Software Engineer",
        startDate: "2023-01",
        endDate: "2024-08",
        description: "Founded and scaled a D2C startup.",
      },
      {
        company: "World Wide Technology",
        title: "Software Engineer Intern",
        startDate: "2025-05",
        endDate: "2025-08",
        description: "Engineered Ask Brett, a RAG-optimized AI agent.",
      },
      {
        company: "OpsCompanion",
        title: "Software Engineer Intern",
        startDate: "2026-01",
        endDate: "2026-05",
        description: "Architected a local-first image PII redaction pipeline.",
      },
    ],
  },
  answers: [
    {
      id: "a1",
      question: "Self-introduction",
      answer: "CS and Business student who ships local-first tools.",
      createdAt: 0,
    },
  ],
  resumes: [
    {
      id: "r1",
      name: "resume",
      createdAt: 0,
      updatedAt: 0,
      /* Ignored: identity.projects takes precedence. */
      parsedData: {
        projects: [{ name: "Stale parsed project" }],
      },
    },
  ],
};

function section(title: string, rows: string): string {
  return `
    <section class="card">
      <div class="card__title">${title}</div>
      <p class="card__hint">Please add ${title.toLowerCase()}.</p>
      ${rows}
      <button type="button" class="add">Add</button>
    </section>`;
}

/*
 * One repeating row, in the real form's shape: `atsx-input` text boxes and
 * 1-based indexed ids (`workExperience[1].company`), captured from a live dump.
 */
function roleRow(section: string, index: number, absorb = true): string {
  const f = (name: string) => `${section}[${index}].${name}`;
  return `
    <div class="row">
      ${datePicker(absorb)}
      <label for="${f("company")}">Company name</label>
      <input id="${f("company")}" class="atsx-input atsx-input-lg" />
      <label for="${f("title")}">Title</label>
      <input id="${f("title")}" class="atsx-input atsx-input-lg" />
      <label for="${f("desc")}">Description</label>
      <textarea id="${f("desc")}" class="atsx-input"></textarea>
    </div>`;
}

/*
 * A searchable select: a role="combobox" wrapper around an input that carries
 * the id. School and Degree are built this way, so they must be driven as
 * typeaheads — the option list is teleported to the end of <body> on open.
 */
function comboRow(id: string, label: string, options: string[]): string {
  return `
    <div class="atsx-form-item">
      <label for="${id}">${label}</label>
      <div role="combobox" aria-haspopup="true" class="atsx-select-selection"
           data-options="${options.join("|")}">
        <input id="${id}" class="atsx-select-search__field" />
      </div>
    </div>`;
}

function datePicker(absorb: boolean): string {
  return `
    <div class="atsx-date-picker" data-absorb="${absorb}">
      <label>Start &amp; end date</label>
      <div class="atsx-date-picker-period">
        <span class="seg-y">YYYY</span><span class="seg-m">MM</span>
      </div>
      <input class="atsx-date-picker-period-hidden-input" />
    </div>`;
}

function page(): string {
  return `
    <form>
      ${section(
        "Basic Information",
        `<label for="name">Name</label>
         <input id="name" class="atsx-input atsx-input-lg" data-test="nameInput" />
         <div role="combobox" aria-haspopup="true" data-cy="phonePrefix"></div>
         <input class="atsx-input atsx-input-lg atsx-phone-input" />
         <label for="email">Email</label>
         <input id="email" class="atsx-input atsx-input-lg" data-test="emailInput" />`,
      )}
      ${section("Work Experience", roleRow("careerExp", 1, false))}
      ${section(
        "Education",
        `<div class="row">
           ${comboRow("education[1].school", "School name", [
             "Washington University in St. Louis",
             "Washington State University",
           ])}
           ${comboRow("education[1].degree", "Degree", [
             "Bachelor's",
             "Master's",
           ])}
           <label for="education[1].fieldOfStudy">Field of study</label>
           <input id="education[1].fieldOfStudy" class="atsx-input" />
         </div>`,
      )}
      ${section("Internship Experience", roleRow("internship", 1))}
      ${section(
        "Honors and Awards",
        `<div class="row">
           <label for="award[1].title">Title</label>
           <input id="award[1].title" class="atsx-input atsx-input-lg" />
           <label>Year</label>
           <input type="text" placeholder="YYYY" class="atsx-input atsx-input-lg" />
           <label for="award[1].desc">Description</label>
           <textarea id="award[1].desc" class="atsx-input"></textarea>
         </div>`,
      )}
      ${section(
        "Project Experience",
        `<div class="row">
           <label for="project[1].name">Project name</label>
           <input id="project[1].name" class="atsx-input atsx-input-lg" />
           <label for="project[1].role">Title</label>
           <input id="project[1].role" class="atsx-input atsx-input-lg" />
           <label for="project[1].link">Project URL</label>
           <input id="project[1].link" class="atsx-input atsx-input-lg" />
           <label for="project[1].desc">Description</label>
           <textarea id="project[1].desc" class="atsx-input"></textarea>
         </div>`,
      )}
      ${section(
        "SNS",
        `<div class="row">
           ${comboRow("sns[1].snsType", "Social media", [
             "LinkedIn",
             "GitHub",
             "X (Twitter)",
           ])}
           <label for="sns[1].link">URL / ID</label>
           <input id="sns[1].link" class="atsx-input atsx-input-lg" />
         </div>`,
      )}
      ${section(
        "Self-introduction",
        `<label for="selfEvaluation[1].selfEvaluation">Self-introduction</label>
         <textarea id="selfEvaluation[1].selfEvaluation" class="atsx-input"></textarea>`,
      )}
      ${section(
        "Work Authorization",
        /*
         * A real <label> exists for each question, but several wrappers separate
         * it from the input and the three questions share a container — which is
         * why control-first label resolution reports "(no label)" on the live
         * page. These exercise findControlNearLabel.
         */
        `<div class="q-list">
           <div class="q">
             <label>Are you legally authorized to work in the US without restriction?</label>
             <div class="ud__select">
               <div class="ud__select__selector">
                 <div role="combobox" aria-haspopup="true" data-q="auth">
                   <input type="search" role="combobox" readonly class="ud__select__selector__search__input" />
                 </div>
               </div>
             </div>
           </div>
           <div class="q">
             <label>Will you now or in the future require visa sponsorship or a visa transfer?</label>
             <div class="ud__select">
               <div class="ud__select__selector">
                 <div role="combobox" aria-haspopup="true" data-q="spon">
                   <input type="search" role="combobox" readonly class="ud__select__selector__search__input" />
                 </div>
               </div>
             </div>
           </div>
         </div>`,
      )}
    </form>`;
}

/*
 * Stands in for the component library: opening a combobox teleports a menu to
 * the end of <body>, and clicking an item writes the choice back. That teleport
 * is the behaviour selectFromTypeahead/selectFromDropdown are built around, so
 * faking anything simpler wouldn't exercise them.
 */
/*
 * A segmented range picker. Only a picker marked data-absorb honours a write,
 * and only in the "YYYY-MM ~ YYYY-MM" encoding — which is the point: the field
 * map tries several encodings and must keep only one that visibly lands.
 */
function wireDatePickers(): void {
  for (const picker of Array.from(
    document.querySelectorAll<HTMLElement>(".atsx-date-picker:not([data-wired])"),
  )) {
    picker.dataset.wired = "1";
    const input = picker.querySelector("input")!;
    input.addEventListener("change", () => {
      if (picker.dataset.absorb !== "true") return;
      const m = input.value.match(/^(\d{4})-(\d{2}) ~ (\d{4})-(\d{2})$/);
      if (!m) return;
      picker.querySelector(".seg-y")!.textContent = m[1];
      picker.querySelector(".seg-m")!.textContent = m[2];
      picker.querySelector(".atsx-date-picker-period")!.append(
        ` ${m[3]}-${m[4]}`,
      );
    });
  }
}

function wireComboboxes(): void {
  const openMenu = (host: HTMLElement, options: string[]) => {
    document.querySelectorAll(".atsx-select-dropdown").forEach((m) => m.remove());
    const menu = document.createElement("div");
    menu.className = "atsx-select-dropdown";
    for (const opt of options) {
      const item = document.createElement("div");
      item.className = "atsx-select-dropdown-menu-item";
      item.textContent = opt;
      item.addEventListener("click", () => {
        const field = host.querySelector("input");
        if (field instanceof HTMLInputElement) field.value = opt;
        menu.remove();
      });
      menu.appendChild(item);
    }
    document.body.appendChild(menu);
  };

  for (const combo of Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="combobox"][data-options]:not([data-wired])',
    ),
  )) {
    combo.dataset.wired = "1";
    const all = (combo.dataset.options ?? "").split("|").filter(Boolean);
    const field = combo.querySelector("input");
    const refresh = () => {
      const typed = (field as HTMLInputElement | null)?.value ?? "";
      const shown = all.filter((o) =>
        o.toLowerCase().includes(typed.toLowerCase()),
      );
      openMenu(combo, shown.length ? shown : all);
    };
    combo.addEventListener("click", refresh);
    field?.addEventListener("input", refresh);
  }

  for (const combo of Array.from(
    document.querySelectorAll<HTMLElement>("[data-q]:not([data-wired])"),
  )) {
    combo.dataset.wired = "1";
    combo.addEventListener("click", () => openMenu(combo, ["Yes", "No"]));
  }
}

/*
 * The real form clones the row markup when Add is clicked. Reproducing that is
 * what exercises the "entry 2 goes in row 2" path.
 */
function wireAddButtons(): void {
  for (const btn of Array.from(document.querySelectorAll("button.add"))) {
    btn.addEventListener("click", () => {
      const card = btn.closest("section")!;
      const rows = card.querySelectorAll(".row");
      const last = rows[rows.length - 1];
      if (!last) return;
      const copy = last.cloneNode(true) as HTMLElement;
      /*
       * Re-index the ids the way the real form does: row 2 of work experience is
       * `workExperience[2].company`, not a suffixed copy of row 1's id.
       */
      const nextIndex = rows.length + 1;
      for (const el of Array.from(copy.querySelectorAll("[id]"))) {
        const old = el.id;
        el.id = old.replace(/\[\d+\]/, `[${nextIndex}]`);
        const lbl = copy.querySelector(`label[for="${old}"]`);
        if (lbl) lbl.setAttribute("for", el.id);
      }
      /*
       * Blank every control, not just the ones with ids — the awards Year box
       * has none, and a real Add mounts an empty row rather than a copy of the
       * last one's values.
       */
      for (const el of Array.from(
        copy.querySelectorAll("input, textarea"),
      )) {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.value = "";
        }
      }
      copy.querySelectorAll("[data-wired]").forEach((el) => {
        (el as HTMLElement).removeAttribute("data-wired");
      });
      last.after(copy);
      wireComboboxes();
      wireDatePickers();
    });
  }
}

function valuesIn(sectionTitle: string, label: string): string[] {
  const card = Array.from(document.querySelectorAll("section.card")).find(
    (s) => s.querySelector(".card__title")?.textContent === sectionTitle,
  )!;
  return Array.from(card.querySelectorAll<HTMLLabelElement>("label"))
    .filter((l) => l.textContent === label)
    .map((l) => {
      const el = document.getElementById(l.htmlFor);
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.value
        : "";
    });
}

beforeEach(() => {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async () => ({
          quickapply: { schemaVersion: 1, profile },
        }),
        set: async () => undefined,
      },
    },
  });
  document.body.innerHTML = page();
  wireAddButtons();
  wireComboboxes();
  wireDatePickers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("TikTok autofill", () => {
  it("fills basic information", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect((document.getElementById("name") as HTMLInputElement).value).toBe(
      "Grace Fu",
    );
    expect(
      (document.querySelector(".atsx-phone-input") as HTMLInputElement).value,
    ).toBe("3142290392");
    expect((document.getElementById("email") as HTMLInputElement).value).toBe(
      "gracefu@wustl.edu",
    );
  });

  /*
   * Regression guard for the Workday "Submit says the field is empty" bug:
   * every fill has to end in a blur, because that is when an ATS reads the
   * value into its own form model.
   */
  it("blurs each field it writes", async () => {
    const seen: string[] = [];
    document.addEventListener("focusout", (e) => {
      const el = e.target;
      if (el instanceof HTMLElement && el.id) seen.push(el.id);
    });
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(seen).toContain("name");
    expect(seen).toContain("email");
  });

  it("routes roles into Work vs Internship by title", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(valuesIn("Work Experience", "Company name")).toEqual([
      "Ameribakes Baking Business",
    ]);
    expect(valuesIn("Internship Experience", "Company name")).toEqual([
      "World Wide Technology",
      "OpsCompanion",
    ]);
  });

  it("adds a row per extra entry instead of overwriting the first", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(valuesIn("Internship Experience", "Title")).toEqual([
      "Software Engineer Intern",
      "Software Engineer Intern",
    ]);
    const descriptions = valuesIn("Internship Experience", "Description");
    expect(descriptions[0]).toContain("Ask Brett");
    expect(descriptions[1]).toContain("PII redaction");
  });

  it("answers the unlabelled work-authorization comboboxes", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    /* Authorized: Yes. Requires sponsorship: No. */
    const answers = Array.from(
      document.querySelectorAll<HTMLInputElement>("[data-q] input"),
    ).map((i) => i.value);
    expect(answers).toEqual(["Yes", "No"]);
  });

  /*
   * The Work Experience section here uses an id prefix the field map does not
   * guess (`careerExp[1].company`), which is the real situation: that section
   * was empty on every capture. It must still fill via the label fallback,
   * scoped to its own section.
   */
  it("falls back to labels when the section's id prefix is unknown", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(
      (document.getElementById("careerExp[1].company") as HTMLInputElement).value,
    ).toBe("Ameribakes Baking Business");
    expect(
      (document.getElementById("careerExp[1].title") as HTMLInputElement).value,
    ).toBe("Founder & Software Engineer");
  });

  it("fills projects using the form's own field names (role/link/desc)", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    /* identity.projects wins over the resume-parsed list. */
    expect(
      (document.getElementById("project[1].name") as HTMLInputElement).value,
    ).toBe("WashU Pointswap");
    expect(
      (document.getElementById("project[1].role") as HTMLInputElement).value,
    ).toBe("Full-Stack Developer");
    expect(
      (document.getElementById("project[2].name") as HTMLInputElement).value,
    ).toBe("Redline");
  });

  it("folds the tech stack into the project description", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    /* The form has no stack field, so it must not be silently dropped. */
    const desc = (
      document.getElementById("project[1].desc") as HTMLTextAreaElement
    ).value;
    expect(desc).toContain("Tech: Next.js, TypeScript, FastAPI");
    expect(desc).toContain("Meal points marketplace");
  });

  it("leaves a project's Title blank rather than inventing one", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    /* Redline has no `role`; a guessed job title would be a false claim. */
    expect(
      (document.getElementById("project[2].role") as HTMLInputElement).value,
    ).toBe("");
  });

  it("pairs each profile link with the right SNS platform", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(
      (document.getElementById("sns[1].snsType") as HTMLInputElement).value,
    ).toBe("LinkedIn");
    expect(
      (document.getElementById("sns[1].link") as HTMLInputElement).value,
    ).toBe("https://linkedin.com/in/gracefu");
    /* Row 2 is added by Autofill, then its platform picker is driven. */
    expect(
      (document.getElementById("sns[2].snsType") as HTMLInputElement).value,
    ).toBe("GitHub");
    expect(
      (document.getElementById("sns[2].link") as HTMLInputElement).value,
    ).toBe("https://github.com/gracefu");
  });

  it("fills the self-introduction from a saved answer", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(
      (
        document.getElementById(
          "selfEvaluation[1].selfEvaluation",
        ) as HTMLTextAreaElement
      ).value,
    ).toContain("local-first tools");
  });

  it("fills awards, folding the issuer into the description", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(
      (document.getElementById("award[1].title") as HTMLInputElement).value,
    ).toBe("Congressional App Challenge — 1st Place");
    const desc = (
      document.getElementById("award[1].desc") as HTMLTextAreaElement
    ).value;
    /* The form has no issuer field, so it must not be silently dropped. */
    expect(desc).toContain("U.S. House of Representatives");
    expect(desc).toContain("House of Code");
  });

  it("pulls a bare year out of free-form award dates", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    const years = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[placeholder="YYYY"]'),
    ).map((i) => i.value);
    /*
     * "2024", then "Class of 2028" -> 2028, then "All Semesters" -> blank.
     * Inventing a year for the last one would put a false date on a real
     * application, so an empty box is the correct outcome.
     */
    expect(years).toEqual(["2024", "2028", ""]);
  });

  it("fills a date range when the picker absorbs the value", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    const shown = document
      .querySelector('[data-absorb="true"] .atsx-date-picker-period')!
      .textContent!.replace(/\s+/g, " ")
      .trim();
    /* WWT internship: 2026-05, still current -> start only, or start ~ end. */
    expect(shown).toMatch(/\d{4}/);
    expect(shown).not.toContain("YYYY");
  });

  it("leaves a picker that ignores the write blank, not wrong", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    const picker = document.querySelector('[data-absorb="false"]')!;
    /* Digits untouched: still the placeholder, never a half-applied date. */
    expect(picker.querySelector(".seg-y")!.textContent).toBe("YYYY");
    expect(picker.querySelector(".seg-m")!.textContent).toBe("MM");
    /* And the hidden input is left as it was found, not holding our guess. */
    expect(
      (picker.querySelector("input") as HTMLInputElement).value,
    ).toBe("");
  });

  it("reports an unabsorbed date range as skipped rather than filled", async () => {
    const { runAutofill } = await import("./runAutofill");
    const r = await runAutofill();
    /*
     * The work-experience group still counts as filled (company/title landed);
     * what matters is that it is reported as partial, not silently complete.
     */
    expect(r.fields.concat(r.skipped).join(" ")).toContain("workExperience");
  });

  it("fills education without pulling fields out of another section", async () => {
    const { runAutofill } = await import("./runAutofill");
    await runAutofill();
    expect(
      (document.getElementById("education[1].school") as HTMLInputElement).value,
    ).toBe("Washington University in St. Louis");
    expect(
      (document.getElementById("education[1].degree") as HTMLInputElement).value,
    ).toBe("Bachelor's");
    expect(
      (document.getElementById("education[1].fieldOfStudy") as HTMLInputElement)
        .value,
    ).toBe("Computer Science and Business");
  });
});
