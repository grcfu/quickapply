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
- `npm test` — Vitest in watch mode (jsdom environment). Use `npx vitest run` for a one-shot CI-style run. Covers pure extractors only — `extractFields` and `findMatchingOption`. Live-DOM autofill behavior is still verified manually via the `DebugPanel`.

## Architecture

Three runtime contexts, one codebase:

1. **Popup** (`index.html` → `src/main.tsx` → `src/App.tsx`) — React UI with `AutofillButton` and `DebugPanel`. Currently sits at the `src/` root; may be moved under `src/popup/` later.
2. **Content script** (`src/content.ts`) — injected into ATS pages declared in `manifest.json`. Listens for `chrome.runtime.onMessage` and runs `runAutofill()` against the live DOM.
3. **Background service worker** (`src/background.ts`) — currently a stub.

**Autofill request flow:** `AutofillButton.onClick` → `chrome.tabs.sendMessage(tabId, { type: "autofill" })` → content script invokes `runAutofill()` → reads the `Profile` from `chrome.storage.local` (key: `"quickapply"`, wrapped in a `{ schemaVersion, profile }` envelope) → iterates `greenhouseFieldMap` (in `src/autofill/greenhouseFields.ts`) → for each entry, locates the DOM node by CSS selector or label-text regex, then writes via `setReactValue` / `setSelectValue` → returns an `AutofillResponse` (`{ ok, filled, fields, skipped, error? }`) used to render popup status.

**Field map pattern.** Each ATS field is one entry in `greenhouseFieldMap`: `kind: "input" | "select"`, selectors and/or `labelPatterns`, plus a `getValue(profile)` accessor. To add fields, extend this map. To add a new ATS, create a parallel field-map module (target layout: `src/ats/lever.ts`, `ashby.ts`, `workday.ts` — currently the only one is `src/autofill/greenhouseFields.ts`) and dispatch on hostname inside `runAutofill`. Each adapter should export the same interface so they're interchangeable. The popup-side host gate is `ATS_HOSTS` in `src/AutofillButton.tsx`; the runtime host gate is `manifest.json` (`content_scripts.matches` and `host_permissions`). All three must stay in sync.

**Why `setReactValue` exists.** ATS pages are React apps with controlled inputs — assigning `el.value = x` doesn't trigger React's synthetic onChange. The code calls the native `HTMLInputElement.prototype` value setter directly, then dispatches bubbling `input`/`change` events. Preserve this pattern when adding new field types; naïve `el.value = ...` will silently fail on most modern ATSs.

**Select option matching** (`findMatchingOption` in `src/autofill/fillField.ts`) is a four-tier fallback: exact text → exact value → substring containment (shortest wins) → token-overlap scoring. This handles inconsistent option labeling across ATSs.

## Profile schema and storage

The canonical type is `Profile` in `src/types/profile.ts` (identity / resumes / answers / settings / metadata). `src/storage/profileStorage.ts` is the only module that touches `chrome.storage.local`:

- All reads/writes go through `getProfile`, `saveProfile`, `updateProfile` (deep-merges via `DeepPartial<Profile>`), `addResume`, `addAnswer`, `exportProfile`, `importProfile`, `clearProfile`.
- `addResume` enforces an 8MB total-profile budget (`MAX_TOTAL_BYTES`) since `chrome.storage.local` is capped.
- `CURRENT_SCHEMA_VERSION = 1`. The envelope shape is intentional — bump the version and add a migration step in `readEnvelope` when the schema changes; don't read raw `profile` blobs bypassing the envelope.

The `DebugPanel` (load / view / export / import / clear) is the current way to seed data; `makeSampleProfile()` in `src/debug/sampleProfile.ts` is the reference example of a populated `Profile`.

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
