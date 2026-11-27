"use strict";
// Static analysis of the working-tree front-end: AC-10 (no external deps), theme variable parity,
// documented palette values, palette contrast (WCAG AA) and HTML accessibility attributes. No browser/server needed.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, ratio, hex } = require("./helpers");

const dir = path.join(ROOT, "src", "static");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const css = fs.readFileSync(path.join(dir, "styles.css"), "utf8");
const js = fs.readFileSync(path.join(dir, "app.js"), "utf8");

function vars(blockStart) {
  const i = css.indexOf(blockStart); const body = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().replace(/\s*\/\*.*$/, "")]));
}
const light = vars(":root {"); const dark = vars(":root.dark-theme {");

describe("AC-10 no external dependencies", () => {
  test("no http(s) URLs or CDN references in html/css/js", () => {
    for (const [n, t] of [["html", html], ["css", css], ["js", js]]) assert.doesNotMatch(t, /https?:\/\/(?!www\.w3\.org)/i, n);
  });
  test("only same-origin script and stylesheet", () => {
    assert.deepEqual([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]), ["/app.js"]);
    assert.deepEqual([...html.matchAll(/<link[^>]*href="([^"]+)"/g)].map((m) => m[1]), ["/styles.css"]);
  });
  test("no package.json / node dependency introduced", () => assert.equal(fs.existsSync(path.join(ROOT, "package.json")), false));
});

describe("Theme variables", () => {
  test("light palette matches Confluence values (--background #f5f6f8, --ink #303240)", () => {
    assert.equal(light.background, "#f5f6f8"); assert.equal(light.ink, "#303240");
  });
  test("dark theme overrides every light colour variable (except fixed ones)", () => {
    const fixed = new Set(["radius", "cyan"]);
    const missing = Object.keys(light).filter((k) => !fixed.has(k) && !(k in dark));
    assert.deepEqual(missing, []);
  });
  test("dark theme defines color-scheme: dark", () => assert.match(css, /:root\.dark-theme\s*{[^}]*color-scheme:\s*dark/));
  test("default (no class) is light: html element has no dark-theme class in markup", () => assert.doesNotMatch(html, /<html[^>]*dark-theme/));
});

describe("Palette contrast (WCAG AA 4.5:1 text)", () => {
  const pairs = [["ink", "background"], ["ink", "surface"], ["muted", "surface"], ["muted", "background"], ["green", "surface"], ["green", "background"],
    ["danger-text", "surface"], ["error-text", "error-bg"], ["ink", "tint"], ["green", "tint"], ["muted", "table-head"]];
  for (const [name, set] of [["light", light], ["dark", dark]]) {
    for (const [fg, bg] of pairs) {
      test(`${name}: --${fg} on --${bg}`, () => {
        const r = ratio(hex(set[fg] || light[fg]), hex(set[bg] || light[bg]));
        assert.ok(r >= 4.5, `contrast ${r.toFixed(2)}:1`);
      });
    }
  }
  // Dark theme flips --ink to a light colour, so .primary and the brand marker use explicit dark-theme overrides.
  const override = (sel) => { const line = css.split(/\r?\n/).find((l) => l.startsWith(":root.dark-theme " + sel + " {")); const m = line && line.match(/color:\s*(#[0-9a-fA-F]{6})/); return m && m[1]; };
  test("dark: primary button text (dark-theme override) on --cyan is readable", () => {
    const fg = override(".primary"); assert.ok(fg, "no dark-theme .primary colour override");
    const r = ratio(hex(fg), hex(light.cyan)); assert.ok(r >= 4.5, `contrast ${r.toFixed(2)}:1`);
  });
  test("dark: brand icon/dot (dark-theme override) on dark-theme sidebar background (--ink) is distinguishable (3:1 large text)", () => {
    const fg = override(".brand-icon, :root.dark-theme .brand-dot"); assert.ok(fg, "no dark-theme brand colour override");
    const r = ratio(hex(fg), hex(dark.ink)); assert.ok(r >= 3, `contrast ${r.toFixed(2)}:1`);
  });
});

describe("Hardcoded colours outside variable blocks", () => {
  test("report-only: count of literal #hex colours in rules (informational, must be < 40)", () => {
    const rules = css.replace(/:root[^{]*{[^}]*}/g, "");
    const n = (rules.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length; assert.ok(n < 40, "literal colours: " + n);
  });
});

describe("Toggle markup accessibility (AC-01, AC-08)", () => {
  test("toggle is a native button with type, id, aria-pressed and aria-label", () => {
    assert.match(html, /<button type="button" class="theme-toggle" id="theme-toggle" aria-pressed="false" aria-label="Switch to dark theme"/);
  });
  test("icon is aria-hidden", () => assert.match(html, /aria-hidden="true" id="theme-toggle-icon"/));
  test("page has lang, skip link, landmarks, dialogs labelled", () => {
    assert.match(html, /<html lang="en">/); assert.match(html, /class="skip-link"/); assert.match(html, /<main id="main">/);
    assert.match(html, /<dialog id="expense-dialog" aria-labelledby/); assert.match(html, /<dialog id="delete-dialog" aria-labelledby/);
  });
  test("every form control has a label", () => {
    for (const id of ["amount", "category", "date", "description", "month-filter", "category-filter"]) assert.match(html, new RegExp(`<label for="${id}"`), id);
  });
  test("focus-visible style defined", () => assert.match(css, /:focus-visible\s*{[^}]*outline/));
  test("theme-color meta present", () => assert.match(html, /<meta name="theme-color"/));
});

describe("Theme script behaviour (source)", () => {
  test("uses localStorage key 'theme' with try/catch", () => {
    assert.match(js, /THEME_KEY = "theme"/); assert.match(js, /try \{ return localStorage\.getItem/);
  });
  test("theme applied before first data load", () => assert.ok(js.indexOf("applyTheme(storedTheme())") < js.lastIndexOf("loadExpenses();")));
  test("no inline script in HTML head to prevent flash of light theme on load (known limitation)", () => {
    assert.match(html, /<script[^>]*src="\/app\.js" defer>/);
  });
});
