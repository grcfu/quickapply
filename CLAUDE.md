# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

QuickApply is a free, local-first Chrome Manifest V3 extension that autofills job applications on major ATS platforms (Greenhouse, Lever, Ashby, Workday). Portfolio project for SWE internship recruiting. The popup UI, background service worker, and content scripts are all built from a single Vite + React 19 + TypeScript project via `@crxjs/vite-plugin`, which reads `manifest.json` and emits a complete unpacked extension into `dist/`.

The differentiator versus Simplify / LazyApply: no accounts, no servers, no paywalls. Everything lives in `chrome.storage.local`.

## Goals and non-goals

**Non-goals — do not propose these:**
- No backend server, ever. The privacy story is the whole point.
- No user accounts, auth, or telemetry.
- No automated form submission. Autofill only; the user always clicks submit. (Avoids ATS ToS issues.)
- No paid features at this stage.
- No Tailwind, no UI library, no state-management library. Plain CSS + `useState`/`useReducer`. Keep dependencies minimal.

## Commands

- `npm run dev` — Vite dev build with HMR. Load the `dist/` directory as an unpacked extension in `chrome://extensions` to test.
- `npm run build` — production build: `tsc -b` (project references → `tsconfig.app.json` + `tsconfig.node.json`) then `vite build`.
- `npm run lint` — ESLint (flat config in `eslint.config.js`; ignores `dist`).
- `npm run preview` — Vite preview server. Not useful for the extension itself; prefer loading `dist/` in Chrome.
- `npm test` — Vitest in watch mode (jsdom environment). Use `npx vitest run` for a one-shot CI-style run. Covers pure logic and jsdom-testable DOM helpers: `extractFields`, `findMatchingOption`, `pickBestOption`, `resolveLabel` / `findControlByLabel` / `findControlsByLabel`, `focusField` / `blurField`, `detectWorkdayPage`, `parseMonthYear`, `pickSkills`, the experience/internship split, and host matching. `tiktokFields.test.ts` goes further and runs the whole of `runAutofill` against a synthetic copy of the TikTok form (stubbed `chrome.storage`, per-file jsdom `url`) — that's the regression guard for cross-section bleed and for the focus/blur bracket. Live-DOM autofill against a real ATS is still verified manually via the `DebugPanel`. Note `CSS.escape` is absent under jsdom — use `escapeAttrValue` in `src/ats/labels.ts` for attribute selectors.

## Architecture

Three runtime contexts, one codebase:

1. **Popup** (`index.html` → `src/main.tsx` → `src/App.tsx`) — React UI with `AutofillButton` and `DebugPanel`. Currently sits at the `src/` root; may be moved under `src/popup/` later.
2. **Content script** (`src/content.ts`) — injected into ATS pages declared in `manifest.json`. Listens for `chrome.runtime.onMessage` and runs `runAutofill()` against the live DOM.
3. **Background service worker** (`src/background.ts`) — currently a stub.

**Autofill request flow:** `AutofillButton.onClick` → `chrome.tabs.sendMessage(tabId, { type: "autofill" })` → content script invokes `runAutofill()` (`src/ats/runAutofill.ts`) → reads the `Profile` from `chrome.storage.local` (key: `"quickapply"`, wrapped in a `{ schemaVersion, profile }` envelope) → picks a field map via `getFieldMapForHost` → for each entry, locates the DOM node by CSS selector or resolved label, then writes via `setReactValue` / `setSelectValue` → returns an `AutofillResponse` (`{ ok, filled, fields, skipped, offPage, currentStep, error? }`) used to render popup status.

**Field map pattern.** Each ATS field is one entry in a field map (`src/ats/greenhouseFields.ts`, `leverFields.ts`, `workdayFields.ts`, `tiktokFields.ts`), registered by host suffix in `src/ats/fieldMapRegistry.ts`. Field kinds: `input`, `select`, `multi-checkbox`, `file`, `multi-typeahead`, and the repeating groups `education-group` / `experience-group` / `website-group` / `certification-group` / `project-group` (see `src/ats/types.ts`). To add fields, extend the map; to add an ATS, add a module plus a registry entry.

`kind: "select"` means "one answer from a fixed set", not "a `<select>` element". `fillSelectField` tries a native `<select>`, then a Workday-style prompt button, then a radio group — so the same field def works across all three renderings.

A select's `getValue` may return a **list** of acceptable phrasings, best first, for questions whose option wording differs per tenant ("How Did You Hear About Us?" is "Company Website" on one Workday tenant and "Careers Website" on the next). `toCandidates` normalizes it and every matcher runs each *tier* across the whole list before loosening — otherwise candidate 1's fuzzy hit would beat candidate 3's exact one. That ordering is also what lets a deliberately broad candidate lead the list: `CAREERS_SITE_SOURCES` starts with bare `"Website"` so the substring tier sweeps up any option containing the word, without giving up the exact matches that ran before it. `fuzzy: false` on a select drops the last-resort token-overlap tier, for questions where a near miss states something untrue rather than approximating it: "Company Career Site" shares the word "career" with "Career Fair", so `howDidYouHear` reports unfilled instead. `workdayFields.test.ts` pins that behaviour against realistic tenant option lists.

**Saved answers reach dropdowns, not just text boxes.** `profile.answers` used to fill only textual controls, which meant the boilerplate every application repeats — "If hired, I agree to comply with …", rendered as a Yes/No prompt — was unreachable. After the textual pass, an unmatched answer is retried as a select via `questionPattern`, so tenant-specific compliance questions live in profile data instead of a field map that can't name them in advance. Two rules keep that safe: the pattern requires the label to **contain the whole question** (no token-overlap tier — the textual pass can afford one because a wrong guess is visible text the user can delete; a wrong guess here silently commits an answer to a compliance question), and `skipIfAnswered` means a stored answer never overwrites an existing selection, whether the applicant's or the field map's. Only the first matching control is answered, so a page repeating the same question twice needs the second one by hand. `workdayQuestions.test.ts` covers this.

**Host gating has two sources, not three.** `fieldMapRegistry.ts` is authoritative — it exports `isSupportedHost`, `getAtsLabel`, and `SUPPORTED_ATS_LABELS`, which the popup (`AutofillButton`, `SiteStatus`) and the content script derive from. Only `manifest.json` (`content_scripts.matches` + `host_permissions`) must be kept in sync by hand — and `fieldMapRegistry.test.ts` now asserts that every registry host suffix is covered by **both** manifest lists. Updating `host_permissions` but not `content_scripts.matches` yields the worst failure mode available: the popup claims the page is supported, and `chrome.tabs.sendMessage` can't reach it because no content script was ever injected. Don't reintroduce a hardcoded host list in the UI either: a parallel list is what previously let the button claim Ashby was supported when no adapter existed.

**Why `setReactValue` exists.** ATS pages are React apps with controlled inputs — assigning `el.value = x` doesn't trigger React's synthetic onChange. The code calls the native `HTMLInputElement.prototype` value setter directly, then dispatches bubbling `input`/`change` events. Preserve this pattern when adding new field types; naïve `el.value = ...` will silently fail on most modern ATSs.

**Why every write is bracketed by focus/blur.** `setReactValue` alone updates React and puts the text on screen, but Workday reads a field into its *own* form model on blur — so a form that looked completely filled still failed Submit with "required field" errors until the value was retyped by hand. `fillTextual` therefore calls `focusField` → write → `blurField` (`src/ats/fillField.ts`), and the restorer used by Undo does the same. Do not write a value without the bracket. The one deliberate exception is `selectFromTypeahead`, which is handed the bare `setReactValue`: blurring mid-typeahead would close the prompt list before an option could be picked.

**Select option matching** (`findMatchingOption` in `src/ats/fillField.ts`) is a four-tier fallback: exact text → exact value → substring containment (shortest wins) → token-overlap scoring. `pickBestOption` in `src/ats/dropdown.ts` applies the same tiers to non-`<select>` dropdowns.

### Workday specifics

Workday is the hard target and drives most of the abstraction here:

- **Labels.** Workday links controls to labels with `aria-labelledby`, not `<label for>`. `src/ats/labels.ts` (`resolveLabel`, `findControlByLabel`) scans *controls* and resolves each one's label through every mechanism in priority order. Scanning `<label>` elements instead — the older approach — silently fails on Workday.
- **Dropdowns.** There are no `<select>` elements. A dropdown is a button that teleports its option list elsewhere in the DOM on click, so options must be found globally after clicking, and their text may live in `data-automation-label`. See `src/ats/dropdown.ts`. Fields whose Workday control is a dropdown must use `kind: "select"`, not `"input"` — `state` was miscategorised this way and never filled.
- **Wizard steps.** One application spans 4-6 separately mounted steps, so most of the field map is absent from any given page. `src/ats/workdayPages.ts` detects the current step and `runAutofill` reports missing tagged fields as `offPage` rather than as failures. Detection is **advisory only** — every field is still attempted regardless, so a wrong `page` tag can never suppress a working fill.
- **Repeating sections.** Education doesn't exist in the DOM until "Add" is clicked. `education-group` creates one panel per profile entry and fills each panel scoped, so entry 2 can't overwrite entry 1.
- **Typeaheads.** Skills and Field of Study only accept values picked from the prompt list they open as you type; writing text alone leaves them empty on submit. Hence `multi-typeahead`, which loops values sequentially (concurrent picks would race for the same DOM node).
- **Iframes.** `all_frames: true` is set because company career pages sometimes embed the Workday form. `chrome.tabs.sendMessage` broadcasts to every frame and the first `sendResponse` wins, so `src/content.ts` only registers its listener when the frame's host has an adapter — otherwise an outer frame would race and reply "no adapter" first.

### TikTok specifics

TikTok (`lifeattiktok.com`, `careers.tiktok.com`) runs ByteDance's in-house ATS, not a third-party one. One long lazily-mounted page instead of a wizard, built from two component libraries: `atsx-*` for the form and `ud-*` for the newer question widgets.

- **The form's own id scheme is the hook.** Every repeating section names its fields `<section>[N].<field>`, **1-based**. `indexed()` in `tiktokFields.ts` turns that into `[id^="education["][id$="].school"]`, enumerating one field across all rows so `scopedControl` takes the Nth for entry N. Strictly better than label matching: `project[2].role` cannot collide with an identically-labelled "Title" elsewhere. Confirmed from a live dump:

  | section | fields |
  | --- | --- |
  | `education[N]` | `.school` `.degree` `.fieldOfStudy` |
  | `internship[N]` | `.company` `.title` `.desc` |
  | `project[N]` | `.name` `.role` (Title) `.link` (URL) `.desc` |
  | `sns[N]` | `.snsType` `.link` |
  | `selfEvaluation[N]` | `.selfEvaluation` |
  | `award[N]` | `.title` `.desc` + an **id-less** Year box (`input[placeholder="YYYY"]`) |
  | `works[N]` | `.link` `.desc` (Work Samples — unmapped) |
  | `language[N]` | `.language` `.proficiency` (unmapped) |

  The names are not guessable — it's `internship`, not `internExperience`; `desc`, not `description`; a project's Title is `role`. Guesses were wrong on all three, which is why label patterns stay as a fallback. **Work Experience is the one prefix still unconfirmed** (the section was empty on every capture); several candidates are listed and `anyOf` anchors on `section[` so `work[` can't match `works[1]`.
- **"Selects" are searchable comboboxes, not `<select>`s.** A `role="combobox"` div wraps an `input.atsx-select-search__field` carrying the id, and the menu teleports to the end of `<body>` on open — Workday's pattern, so `LIST_SELECTOR`/`OPTION_SELECTOR` in `dropdown.ts` cover `atsx-`/`ud-` classes too. **School, Degree, Social media, Language and Proficiency must be `kind: "typeahead"`**; writing text leaves them empty on submit. A typeahead that finds no options costs ~2.7s of timeouts, so a wrong `kind` is slow as well as broken.
- **A picker is fillable even when `readonly`.** Combobox search fields are routinely `readonly` — you pick from the menu instead of typing — so `isFillable` treats `role="combobox"` / `aria-haspopup` as fillable regardless. Without that, TikTok's work-authorization questions reported "select not found" while their labels matched perfectly. A plain readonly text box is still rejected.
- **Three tiers are needed to find a label-only field, and all three earn their place.** `resolveLabel` ends with a `nearbyText` tier, and its ancestor walk **stops at the first wrapper holding another control** — without that guard it climbed to the `<form>` and returned the page's first label ("Name") for every unlabelled control. Even so, the work-authorization comboboxes still resolve to nothing on the live page: a real `<label>` exists but too many wrappers separate it from the input. Those are found by `findControlNearLabel`, which searches label-first and takes the first control *following* the matched text. It is the last tier tried precisely because it is the loosest.
- **Sibling sections share field labels** where the id fallback is used. `findGroupContainer` locates a section by its title, then `sectionFor` climbs to the tightest ancestor holding **exactly one Add button**. Section titles are plain divs, so `sectionTitles` considers generic elements — but only the innermost one holding the text.
- **`countRows` needs the label fallback.** A selector-only count returns 0 forever on a label-driven map, which made the first entry click Add before filling anything and then abandon the section.
- **Dates use a verified write (`kind: "date-range"`).** "Start & end date" is one segmented picker per row: the digits are `YYYY`/`MM` **spans**, and the value sits in an **id-less** `input.atsx-date-picker-period-hidden-input`. The accepted value encoding isn't discoverable from the markup, so `fillDateRange` tries a few separators and **checks each against the picker's rendered text**, clearing anything that didn't land. That inversion is what makes guessing acceptable: a miss leaves the field blank and reported, never a date the profile doesn't contain. Two cost controls matter — the commit wait is 200 ms, and if the written text survives verbatim the component clearly isn't parsing that input, so remaining encodings are skipped rather than each paying a timeout (this took one fixture from 22 s to 4 s). A month is required; a bare year is refused rather than defaulted to January.
- **Work vs internship is inferred from the job title** (`isInternship` in `profileHelpers.ts`); nothing in `Profile` records it.
- **Awards fold the issuer into the description.** The form has Title / Year / Description and no issuer field, so `Award.issuer` is prefixed onto the description rather than dropped. `Award.date` is free-form (`"Class of 2028"`, `"Summer 2024"`) and the Year box takes `parseMonthYear(date)?.year` — which is `undefined` for `"All Semesters"`, correctly leaving it blank instead of inventing a year.
- **Unmapped, blocked on the schema not on selectors:** Work Samples (`works[]`) and Language Skills (`language[]`). The ids are known — `Profile` just has nowhere to store the data. Extend the schema first.

**Writing an adapter for a hook-less ATS.** Developer tools → **Copy page structure** (`src/ats/dumpForm.ts`) dumps every control on the active page — id, label, attributes, and the inner id of a combobox wrapper — plus a **text landmarks** list of every short direct-text element, which is the only way to see the section titles and question prompts since they're unlabelled divs. Values are deliberately excluded so the dump can be shared. Use it rather than guessing; the first version of the TikTok map was inferred from a screenshot and got the field *kinds* wrong, not just the selectors. Sections are lazily mounted, so click Add in each repeating section before dumping or its fields won't be in the DOM.

## Profile schema and storage

The canonical type is `Profile` in `src/types/profile.ts` (identity / resumes / answers / skills / settings / metadata). `Award` is kept separate from `Certification` on purpose: a certification has an issuer, credential id and expiry and gets its own ATS section (Workday); an award has none of those and only appears as Title / Year / Description (TikTok). `src/storage/profileStorage.ts` is the only module that touches `chrome.storage.local`:

- All reads/writes go through `getProfile`, `saveProfile`, `updateProfile` (deep-merges via `DeepPartial<Profile>`), `addResume`, `addAnswer`, `exportProfile`, `importProfile`, `clearProfile`.
- `addResume` enforces an 8MB total-profile budget (`MAX_TOTAL_BYTES`) since `chrome.storage.local` is capped.
- `CURRENT_SCHEMA_VERSION = 1`. The envelope shape is intentional — bump the version and add a migration step in `readEnvelope` when the schema changes; don't read raw `profile` blobs bypassing the envelope.

- `Profile.skills` is read through `pickSkills` (`src/ats/profileHelpers.ts`), which falls back to the default resume's `parsedData.skills` so profiles saved before the field existed still fill Workday's skills section.
- Same curated-wins-then-fall-back-to-parsed rule applies to `pickExperiences` and `pickProjects`. **`identity.projects` is the canonical home for projects** — they used to exist only under `resumes[].parsedData.projects`, so a profile with no uploaded resume had nowhere to put them at all.
- `Project` mirrors `Experience` (name / role / dates / description) because ATS project sections ask the same questions a job does. `Project.tech` has no field on any ATS seen so far; `projectDescription()` prepends it as `Tech: …` so the stack isn't silently dropped, the same treatment `Award.issuer` gets.

The `DebugPanel` (load / view / export / import / clear) is the current way to seed data; `makeSampleProfile()` in `src/debug/sampleProfile.ts` is the reference example of a populated `Profile`. Real personal data belongs in a gitignored `my-profile.json` at the repo root, loaded via Developer tools → Import profile — never commit it.

## Conventions

- Prefer `async`/`await` over `.then()` chains.
- New code that touches `chrome.*` APIs should be wrapped in `src/storage/` or a new `src/utils/` module — popup components and content scripts should be consumers, not direct callers. (Existing direct calls in `AutofillButton.tsx` and `content.ts` predate this convention; migrate as you touch them.)
- Surface errors to the user via the popup status UI (`AutofillResponse.error`, `DebugPanel` status). Never silently swallow.
- Commit messages use conventional-commit-ish prefixes: `feat:`, `fix:`, `refactor:`, `docs:`.

## TypeScript / Chrome typing

- `tsconfig.app.json` enables `verbatimModuleSyntax` and `erasableSyntaxOnly` — type-only imports must use `import type`, and enums / parameter properties are disallowed.
- `noUnusedLocals` and `noUnusedParameters` are on; prefix intentionally-unused params with `_`.
- `chrome.*` types come from `@types/chrome` (declared in `tsconfig.app.json` `types`). Content scripts and the popup both have access; the background worker is a module (`"type": "module"` in `manifest.json`).

## Working style

- The author is a student learning as they build. Briefly explain non-obvious decisions when making them.
- One milestone at a time. If the prompt asks for X, do X — don't also do Y because it seems related.
- After making a change, tell the user how to verify it worked (what to click in `chrome://extensions` or the popup, what output to expect).
- Make edits and run commands directly; the user will approve at the prompt rather than copy-pasting.
