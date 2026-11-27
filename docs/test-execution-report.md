# Test Execution Report - Dark/Light Theme Toggle and Expense Tracker regression

- Jira: EPMCDMETST-72832
- Date: 2026-11-25
- Tested version: uncommitted working tree on branch `main` (modified `src/static/app.js`, `index.html`, `styles.css`, `src/web.java`)
- Tester: QE agent. The initial run (Run 1) was against unmodified application code. Run 2 and Run 3 (re-tests) were done after fixes (section 7).
- Latest result: **Run 3: 160 tests, 160 passed, 0 failed, 0 skipped.**

## 1. Summary

Run 3 (latest, after all fixes and assertion corrections):

| Suite | File | Tests | Pass | Fail | Skip |
|---|---|---|---|---|---|
| API / backend (Java server) | `tests/api.test.js` | 27 | 27 | 0 | 0 |
| Static analysis / palette / markup | `tests/static-theme.test.js` | 41 | 41 | 0 | 0 |
| Browser UI (headless Edge) | `tests/ui.test.js` | 92 | 92 | 0 | 0 |
| **Total** | | **160** | **160** | **0** | **0** |

Run 2 (after the first fixes, before D-05 and the assertion corrections): 160 tests, 157 passed, 3 failed (api 26/27, static-theme 39/41, ui 92/92).

Run 1 (initial, before fixes), kept for traceability:

| Suite | File | Tests | Pass | Fail | Skip |
|---|---|---|---|---|---|
| API / backend (Java server) | `tests/api.test.js` | 27 | 22 | 5 | 0 |
| Static analysis / palette / markup | `tests/static-theme.test.js` | 41 | 37 | 4 | 0 |
| Browser UI (headless Edge) | `tests/ui.test.js` | 92 | 86 | 6 | 0 |
| **Total** | | **160** | **145** | **15** | **0** |

Shared harness: `tests/helpers.js` (not a test file). In Run 1 the 15 failing tests mapped to 6 distinct defects plus 1 observation (section 4). They are product findings, not flaky tests. The full run was repeated and the failures were identical.

Verdict: the toggle works functionally (AC-01 to AC-06, AC-08, AC-09 and AC-10 pass). AC-07 (readability and contrast) FAILS in dark theme (primary buttons and brand marker). Several backend validation gaps were also found.

## 2. Sources reviewed

- Confluence: reached through the CodeMie assistant (id 168cd75d...). It returned the approved Requirements Analysis (pageId 4489218, AC-01..AC-10 verbatim), plus the Implementation Plan (4554753) and Architecture and Design (4554772) titles and IDs. It did not return the full Plan/Architecture text. The only hex values it found were `--background: #f5f6f8` and `--ink: #303240` (verified by a test). Direct Confluence access from my own tools was not available.
- Local: `docs/EPMCDMETST-72832-development-doc.md`, `README.md`, `src/web.java` and the three static files.
- Existing test framework: none. There was no `tests/` directory and no `package.json`. Tests use only Node 24 built-ins (`node:test`, global `fetch` and `WebSocket`).

## 3. Approach and environment

- OS: Windows 11, Git Bash. Node v24.22.1, Java 25.0.5, Microsoft Edge 157/158 (headless, driven through the Chrome DevTools Protocol, no npm packages).
- Isolation: a user instance of the app was already listening on port 8000 and uses the real `expenses-java.json`. Tests therefore start a patched COPY of `web.java` in a temp directory (port 8123, copy of the working-tree `src/static`, its own data file). The app source and the real data file were not touched (data file mtime unchanged).
- Run command: `node --test --test-concurrency=1 tests/api.test.js tests/static-theme.test.js tests/ui.test.js` (about 29 s). Passing the directory (`node --test tests`) does not work on this Node version, so list the files.

## 4. Defects

| ID | Severity | Area | Status |
|---|---|---|---|
| D-01 | High | Dark theme, primary buttons unreadable | Fixed, verified (section 7) |
| D-02 | Medium | Dark theme, sidebar brand marker low contrast | Fixed, verified (section 7) |
| D-03 | Medium | Server validation, invalid or empty date returns 500 | Fixed, verified |
| D-04 | Low | Server validation, no length limits | Fixed, verified |
| D-05 | Low | Security, X-Expense-Request header not enforced | Fixed, verified (server returns 403; no approved design text was retrievable, enforcement added at the user's request) |
| D-06 | Low | Light theme marginal contrast (pre-existing) | Fixed, verified |
| D-07 | Info | Dark theme design, sidebar is light | Observation |

**D-01 (High, AC-07) Primary button text unreadable in dark theme.** `.primary { color: var(--ink); background: var(--cyan) }` and the dark `--ink` is `#eceef4`, so light text sits on cyan `#39c2d7`, contrast 1.83:1 (4.5:1 needed). Affects "Add expense", "Add your first expense" and "Save expense".
Repro: open the app, click the theme toggle (Dark mode), look at "+ Add expense"; open the dialog and look at "Save expense".
Failing tests: static-theme "dark: primary button text"; ui "page text / expense dialog text meets WCAG AA contrast" (dark).
Suggested fix: use a fixed dark text colour (for example `#1f212b`) on `.primary` in dark theme.

**D-02 (Medium, AC-07) Brand marker low contrast in dark theme.** The sidebar background is `var(--ink)` = `#eceef4` in dark theme; the cyan brand icon and dot give 1.83:1 (3:1 needed for large text).
Repro: toggle to dark and look at the "epam" logo. Failing tests: static-theme "dark: brand icon/dot"; ui dark "page text meets WCAG AA contrast".

**D-03 (Medium, backend) Invalid or empty date returns HTTP 500 "Storage failure".** `LocalDate.parse` throws `DateTimeParseException`, which is not mapped to a 400.
Repro: POST `/api/expenses` with `{"amount":"1.00","category":"Food","description":"x","date":"2026-13-45"}` (or `"date":""`) and header `X-Expense-Request: 1`. Expected 400 with a validation message; actual 500. PUT behaves the same. The UI uses a date input, so users rarely reach this path.
Failing tests: "rejects invalid date", "rejects empty date".

**D-04 (Low, backend) Length limits exist only in the HTML.** A category over 80 characters and a description over 500 characters are accepted by the API (201). Failing tests: "rejects category > 80 chars", "rejects description > 500 chars".

**D-05 (Low, security) The X-Expense-Request header is not enforced.** The client sends it, but a POST without it is accepted (201). If it is meant as a CSRF guard it has no effect. Failing test: "request without X-Expense-Request header is rejected". Not part of the theme requirements; the Development Agent should confirm intent.

**D-06 (Low, AC-07, pre-existing) Light theme marginal contrast.** `--green #007e8a` gives 4.46:1 on `--background` and 4.36:1 on `--tint` (4.5 needed). Affects the eyebrow text, profile initial, stat labels, count badge and category tags. The breadcrumb "/" separator is 1.98:1 (decorative). `--green` has the same value in HEAD, so this predates the theme work.
Failing tests: static-theme "light: --green on --background" and "light: --green on --tint"; ui light "page text meets WCAG AA contrast".

**D-07 (Observation) The dark theme sidebar is light.** The sidebar uses `var(--ink)` as background, so it becomes near-white (`#eceef4`) next to a dark page. Text colours were overridden so it is readable, but this may not be the intended design. Please confirm against the Architecture page. No test fails for this.

Known limitation from the dev doc (not asserted): the script is deferred and there is no inline head script, so a user with dark saved may see a brief light flash on load. Not measured.

## 5. Coverage against requirements

| Req | Result | Tests |
|---|---|---|
| AC-01 toggle visible and accessible | PASS | ui AC-01 (in topbar, inside viewport, sized); reachable and uncovered at 8 widths in both themes |
| AC-02 default Light | PASS | ui AC-02 |
| AC-03 switch to Dark without refresh | PASS | ui AC-03 (page marker survives, aria-pressed, label, meta theme-color) |
| AC-04 switch back to Light | PASS | ui AC-04 |
| AC-05 persistence | PASS | ui AC-05 (3 tests), invalid stored value falls back to Light, localStorage unavailable (session-only, app still works) |
| AC-06 consistent theming | PASS | ui "no hard-coded light surface" (dark), "dialogs follow the theme"; static variable parity (dark overrides every light variable) |
| AC-07 readability and contrast | PASS (Run 3) | Static palette and rendered-page contrast checks pass in both themes. Run 1: FAIL, D-01, D-02 (dark), D-06 (light) |
| AC-08 keyboard and screen reader | PASS | Tab reaches toggle, Enter and Space operate it, focus outline, aria-pressed and state-dependent aria-label, skip link first, Esc closes dialog and restores focus |
| AC-09 no impact on expense features | PASS (UI) | Add, edit, delete (confirm and cancel), category/month filters, reset, empty state, totals/average/top category, charts, 6 invalid amounts, XSS escaping, API-failure notice; all in both themes |
| AC-10 no external dependencies | PASS | static: no http(s) URLs, only `/app.js` and `/styles.css`, no `package.json` |
| Sidebar visibility | PASS | full (1280), icon rail (900), top bar (480), both themes; nav anchor works |
| Responsiveness | PASS | no horizontal overflow at 320/375/480/768/900/1024/1280/1920 in both themes; dialog fits at 320 |
| Backend CRUD, filter, totals, persistence | PASS (Run 3) | api.test.js |

## 6. Limitations

- Not run: Firefox, Safari, real mobile devices, screen readers (NVDA/VoiceOver), print, `prefers-color-scheme`. Only headless Edge was used.
- Contrast was computed from computed styles and CSS variables. Text over gradients or images, hover and focus states, and non-text UI contrast (WCAG 1.4.11) were not checked. Open dialogs were scanned.
- The task mentions LocalStorage for expenses. In this codebase expenses are stored server-side by the Java app in `expenses-java.json`; only the theme preference uses `localStorage`. Expense storage was tested through the API and file, and LocalStorage only for the theme key.
- The Plan and Architecture page text was not fully available (section 2), so design details beyond the ACs (exact dark palette) could not be verified. The dark palette was checked for self-consistency only.
- Viewports are emulated through DevTools. Headless scrollbars take about 15 px, so the 480 px top-bar check accepts a width of 440 px or more.
- Flash of light theme on load, cross-tab theme sync and visual-regression screenshots were not tested.
- Tests start their own server on port 8123 (override with TEST_PORT) and use a patched copy of `web.java` only to change the port.

## 7. Re-test after fixes (Run 2)

Command: `node --test --test-concurrency=1 tests/api.test.js tests/static-theme.test.js tests/ui.test.js`
Result: 160 tests, 157 passed, 3 failed, 0 skipped. No test file was changed between Run 1 and Run 2.

Fixes applied by the Development side (files: `src/static/styles.css`, `src/web.java`):

| Defect | Change | Verified by |
|---|---|---|
| D-01 | Dark theme: `.primary` text colour `#1f212b` | ui dark "page text / expense dialog text meets WCAG AA contrast" now pass |
| D-02 | Dark theme: `.brand-icon` and `.brand-dot` colour `#00727d` | ui dark "page text meets WCAG AA contrast" now passes |
| D-03 | New `checkDate()` maps `DateTimeParseException` to HTTP 400 "Invalid date" (POST and PUT) | api "rejects invalid date", "rejects empty date" now pass |
| D-04 | New `checkLengths()`: category over 80 and description over 500 return 400 (POST and PUT) | api "rejects category > 80 chars", "rejects description > 500 chars" now pass |
| D-06 | Light `--green` `#007e8a` changed to `#00727d`; breadcrumb separator colour changed from hard-coded `#b4b8c8` to `var(--muted)` (it measured 1.98:1 in the light UI contrast test) | static "light: --green on --background / --tint" and ui light contrast tests now pass |

Still failing (3):

1. **D-05, api "request without X-Expense-Request header is rejected (CSRF guard)".** Not implemented. The header is only sent by the client (`app.js`, present since the original commit). No server code, README, development doc or retrievable approved design requires the server to check it, so enforcement was not added. Needs a decision: enforce (for example 403 on POST/PUT/DELETE without the header) or drop the test.
2. **static "dark: primary button text (--ink on --cyan) is readable".** The test computes contrast from the variables `dark --ink` (`#eceef4`) and `light --cyan` (`#39c2d7`) = 1.83:1. The fix overrides the colour in dark-theme selectors and leaves those variables unchanged, so this variable-pair assertion still reports 1.83:1. The rendered button now passes the browser test.
3. **static "dark: brand icon/dot (cyan) on dark-theme sidebar background (--ink) is distinguishable".** Same cause: the test checks `light --cyan` against `dark --ink` (1.83:1), not the overridden brand colour actually rendered.

For 2 and 3, either the assertions should target the real colour pairs, or the variable scheme should be reworked (for example separate tokens for sidebar background and button text). Changing `--cyan` or `--ink` directly would alter the light brand colour and all text colours, so it was not done. Test assertions were not changed.

Not re-checked in Run 2: D-07 (dark sidebar is light, observation, unchanged) and the limitations in section 6, which still apply.

## 8. Final re-test (Run 3)

Command: `node --test --test-concurrency=1 tests/api.test.js tests/static-theme.test.js tests/ui.test.js`
Result: **160 tests, 160 passed, 0 failed, 0 skipped.** The test count is unchanged (160).

Changes since Run 2:

- **D-05 fixed (`src/web.java`):** POST, PUT and DELETE on `/api/expenses` without the `X-Expense-Request` header now return 403 "Missing X-Expense-Request header". GET is unaffected. The bundled client already sends the header. Test "request without X-Expense-Request header is rejected" now passes. Note: no approved design text for this header could be retrieved; enforcement was added on explicit user instruction.
- **Two assertions corrected (`tests/static-theme.test.js`), authorised by the user:** "dark: primary button text" and "dark: brand icon/dot" previously computed contrast from the variable pairs `dark --ink` / `light --cyan`, which is not what is rendered (dark `.primary` and the brand marker use dark-theme CSS overrides). They now read the actual override colour from the `:root.dark-theme .primary` and `:root.dark-theme .brand-icon, ... .brand-dot` rules in `styles.css` and check it against the real background (`.primary` colour on `--cyan` at 4.5:1, brand colour on dark `--ink` at 3:1). Thresholds are unchanged, a missing override fails the test, and no test was removed or skipped. The rendered colours are independently covered by the ui dark-theme contrast tests, which pass.

Remaining observations (not failures): D-07 (dark sidebar is light) is a design question; the limitations in section 6 still apply.
