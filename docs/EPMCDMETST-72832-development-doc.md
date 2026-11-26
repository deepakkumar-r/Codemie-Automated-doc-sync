# Development Document – Dark/Light Theme Toggle (EPMCDMETST-72832)

## Summary
Added a Dark/Light theme toggle to the Expense Tracker. The choice is saved in `localStorage` (key `theme`) and restored on load. Light is the default.

## Sources used
- **Requirements Analysis – Theme Toggle for Expense Tracker** (Confluence page 4489218): retrieved in full, including the Jira story text and acceptance criteria. The output was truncated partway through AC-06.
- **Implementation Plan** and **Architecture and Design**: only summaries were available, because the CodeMie assistant would not return the pages verbatim. The implementation follows those summaries.
- **Jira story**: not retrieved separately; its text is reproduced in the Requirements Analysis page.

## Files changed (all under `src/static/`)

### `index.html`
- Added a `#theme-toggle` button in the topbar, next to the profile avatar.
- The button has `aria-pressed`, a dynamic `aria-label`, an icon and a text label.

### `styles.css`
- Moved previously hardcoded colours (`#fff`, `#e4f7fa`, `#fff1ef` and similar) into CSS variables. These cover surfaces, tints, tracks, chart colours and error colours.
- Added a `:root.dark-theme` block that overrides those variables.
- Replaced hardcoded colours in cards, panels, topbar, inputs, table, dialogs, notices, charts and tags with the variables. Light mode should look the same as before.
- Added `.theme-toggle` styling.
- At 480px and below, where the topbar was hidden, it now shows as a compact bar so the toggle stays reachable.

### `app.js`
- Added `THEME_KEY = "theme"`, `storedTheme()` and `applyTheme(theme, persist)`.
- `applyTheme` toggles the `dark-theme` class on `<html>`, syncs `aria-pressed`, the label and the icon, and updates the `theme-color` meta tag.
- The saved theme is applied at startup. A click handler on the toggle switches themes without a reload.
- If `localStorage` is unavailable, the theme lasts only for the session.
- The toggle is a native `<button>`, so Tab, Enter and Space work.

## Not changed
Expense add, edit, delete, filter and total logic, `web.java`, and all other files. No Git operations were performed.

## Verification
Only `node --check` on `app.js` was run, and it passed. The app was not launched and no other testing was done.

## Open items
- **Dark palette:** the retrieved text had no hex values. Colours were derived from the existing EPAM charcoal `#303240` and cyan `#39c2d7`. Check them against the Architecture page.
- **Contrast:** not measured in either theme.
- **Flash on load:** the script is deferred, so a user with dark mode saved may see a brief light flash. An inline head script would fix it, but the architecture summary did not call for one.
