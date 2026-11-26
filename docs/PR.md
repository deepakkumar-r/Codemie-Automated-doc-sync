Title

  EPMCDMETST-72832: Add Dark/Light theme toggle to Expense Tracker

  Description

  - Adds a Dark/Light toggle button in the topbar. It is a native <button> with aria-pressed and a dynamic aria-label, so it
    works with the keyboard.
  - The choice is saved in localStorage (key theme) and restored on load. Light is the default. If localStorage is
    unavailable, the theme lasts only for the session.
  - styles.css now uses CSS variables for the previously hardcoded colours. A :root.dark-theme block overrides them, and
    app.js toggles the dark-theme class on <html>.
  - At 480px and below, the topbar shows as a compact bar so the toggle stays reachable.
  - web.java also gets server hardening (see Changes).
  - Adds a Node test suite with 160 tests and a test execution report.

  Changes

  The branch is 1 commit ahead of main (8fcacb4). The commit touches 9 files, +873/-31.
  - index.html: adds #theme-toggle in a new .topbar-actions wrapper next to the profile avatar.
  - styles.css: adds the colour variables, the dark palette, the .theme-toggle style and a responsive topbar. It also
    includes dark-theme contrast fixes.
  - app.js: adds theme storage, apply and restore logic, a click handler and a theme-color meta update.
  - web.java (server hardening):
    - An invalid date now returns a client error instead of a 500.
    - Category (80 characters) and description (500 characters) length limits are enforced.
    - Non-GET requests without an X-Expense-Request header now get a 403. The bundled client already sends that header.
  - tests/: three test files plus a helper, using only Node built-ins and headless Edge via the Chrome DevTools Protocol.
  - docs/test-execution-report.md: the test report.

  Test results

  These numbers come from docs/test-execution-report.md. The agent did not re-run the tests.

  ┌────────────────┬────────────────────────────────────────┐
  │      Run       │                 Result                 │
  ├────────────────┼────────────────────────────────────────┤
  │ Run 1          │ 145 passed, 15 failed (6 defects)      │
  ├────────────────┼────────────────────────────────────────┤
  │ Run 2          │ 157 passed, 3 failed                   │
  ├────────────────┼────────────────────────────────────────┤
  │ Run 3 (latest) │ 160 of 160 passed, 0 failed, 0 skipped │
  └────────────────┴────────────────────────────────────────┘

  - Run 3 by suite: api.test.js 27/27, static-theme.test.js 41/41, ui.test.js 92/92.
  - Acceptance criteria AC-01 to AC-10 are reported as passing, including contrast (AC-07).
  - Defects D-01 to D-06 are fixed and verified. D-07 (the sidebar stays light in dark theme) is an open design observation,
    not a failure.
  - Run command: node --test --test-concurrency=1 tests/api.test.js tests/static-theme.test.js tests/ui.test.js. It takes
    about 29 seconds and needs Node 24 and Edge.

  Gaps and risks to decide on

  1. Untracked files. docs/EPMCDMETST-72832-development-doc.md is not committed. Do you want it in the PR? The other
     untracked items are .build/, .claude/, .codemie/, codemie-mcp-connect-service/, docs/codemie/, expenses-java.json (your
     real data file) and out/. I'd leave these out.
  2. Scope creep. The web.java changes go beyond a theme toggle. They are the fixes for defects D-03, D-04 and D-05. The 403
     header check was added at your request without an approved design text. I'd mention it in the PR description, or split
     it into a separate PR.
  3. Stale docs.
     - The dev doc says web.java was unchanged and that only node --check was run. Both are outdated.
     - The test report header says the tested version was an uncommitted tree on main.
  4. Requirements sources. The agent worked from the local docs, which quote the Confluence acceptance criteria. It did not
     retrieve the Jira story directly. The dark palette hex values were derived, not taken from the spec.
  5. Coverage limits. Only headless Edge was tested. Firefox, Safari, real mobile devices, screen readers, print and
     prefers-color-scheme were not covered.
  6. Known flash on load. A user with dark mode saved may see a brief light flash, because the script is deferred and there
     is no inline head script.
  7. No CI. There is no package.json or test script.

  The branch is already pushed to origin at 8fcacb4.

  Reply "Approved" and I'll create the PR into main and share the URL. You can also ask me to change the title or description
  first, or to add the dev doc. If you approve, I'll include the Claude Code attribution line in the PR body.