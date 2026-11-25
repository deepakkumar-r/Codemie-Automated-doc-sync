"use strict";
// Browser (headless Edge via CDP) tests: theme toggle ACs, expense CRUD/filter/validation in both themes,
// sidebar, accessibility, responsiveness, runtime contrast. Skipped entirely if Edge/Chrome is not installed.
const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, api, clearAll, launchBrowser, findEdge, BASE } = require("./helpers");

const edge = findEdge();
const opts = { skip: edge ? false : "No Edge/Chrome found" };
let srv, b;
const today = new Date(); const pad = (n) => String(n).padStart(2, "0");
const MONTH = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
const D = (d) => `${MONTH}-${pad(d)}`;
const BG = { light: "rgb(245, 246, 248)", dark: "rgb(31, 33, 43)" };
const CLICK = (id) => `document.getElementById("${id}").click()`;

const seed = async () => {
  await clearAll();
  for (const e of [{ amount: "10.10", category: "Food", description: "Lunch", date: D(1) }, { amount: "20.20", category: "Food", description: "Dinner", date: D(2) },
    { amount: "5.05", category: "Transport", description: "Bus", date: D(2) }]) await api("POST", "/api/expenses", e);
};
const text = (sel) => b.ev(`document.querySelector(${JSON.stringify(sel)}).textContent.trim()`);
const isDark = () => b.ev(`document.documentElement.classList.contains("dark-theme")`);
const setTheme = async (t) => { await b.ev(`localStorage.setItem("theme", ${JSON.stringify(t)})`); await b.reload(); };
const fill = (o) => b.ev(`(() => { const o = ${JSON.stringify(o)}; for (const k in o) { const el = document.getElementById(k); el.value = o[k]; el.dispatchEvent(new Event("input", { bubbles: true })); } })()`);
const ready = () => b.until(`document.getElementById("loading").hidden === true`);
const rows = () => b.ev(`[...document.querySelectorAll("#expense-rows tr")].map(r => [...r.children].slice(0,4).map(c => c.textContent.trim()).join("|"))`);
const rowBtn = (label) => b.ev(`[...document.querySelectorAll("#expense-rows .row-action")].find(x => x.getAttribute("aria-label") === ${JSON.stringify(label)}).click()`);
const selectVal = (id, v) => b.ev(`(() => { const s = document.getElementById(${JSON.stringify(id)}); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event("change")); })()`);

// In-page WCAG contrast scan of visible text.
const SCAN = `(() => {
  const parse = (s) => { const m = s.match(/rgba?[(]([^)]+)[)]/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = (el) => { const stack = []; for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; if (!stack.length || stack[stack.length-1].a < 1) { const bb = parse(getComputedStyle(document.body).backgroundColor); if (bb && bb.a > 0) base = bb; } for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base); return base; };
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!el.getClientRects().length || el.closest("[aria-hidden=true],.sr-only,script,style")) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.fontSize === "0px") continue;
    const fg = parse(cs.color); if (!fg) continue; const bg = bgOf(el); const f = over(fg, bg);
    const [a, b2] = [lum(f), lum(bg)].sort((x, y) => y - x); const ratio = (a + .05) / (b2 + .05);
    const px = parseFloat(cs.fontSize); const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) out.push({ el: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/ +/).join(".") : ""), text: el.textContent.trim().slice(0, 30), ratio: +ratio.toFixed(2) });
  }
  return out;
})()`;

before(async () => {
  if (!edge) return;
  srv = await startServer(); b = await launchBrowser(edge); await seed();
  await b.viewport(1280, 900); await b.goto(BASE + "/"); await b.ev(`localStorage.clear()`); await b.reload(); await ready();
});
after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

describe("Theme toggle acceptance criteria", opts, () => {
  test("AC-01 toggle button visible in header and inside viewport", async () => {
    const r = await b.ev(`(() => { const e = document.getElementById("theme-toggle"); const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0, inTopbar: !!e.closest(".topbar"), vis: getComputedStyle(e).visibility }; })()`);
    assert.ok(r.w > 20 && r.h > 20 && r.inView && r.inTopbar && r.vis === "visible", JSON.stringify(r));
  });
  test("AC-02 default is Light when nothing stored", async () => {
    await b.ev(`localStorage.clear()`); await b.reload(); await ready();
    assert.equal(await isDark(), false);
    assert.equal(await b.ev(`getComputedStyle(document.body).backgroundColor`), BG.light);
    assert.equal(await text("#theme-toggle-text"), "Dark mode");
    assert.equal(await b.ev(`document.getElementById("theme-toggle").getAttribute("aria-pressed")`), "false");
  });
  test("AC-03 switch to Dark without page refresh", async () => {
    await b.ev(`window.__noReload = 1; ${CLICK("theme-toggle")}`);
    assert.equal(await isDark(), true);
    assert.equal(await b.ev(`window.__noReload`), 1, "page reloaded");
    assert.equal(await b.ev(`getComputedStyle(document.body).backgroundColor`), BG.dark);
    assert.equal(await text("#theme-toggle-text"), "Light mode");
    assert.equal(await b.ev(`document.getElementById("theme-toggle").getAttribute("aria-pressed")`), "true");
    assert.equal(await b.ev(`document.getElementById("theme-toggle").getAttribute("aria-label")`), "Switch to light theme");
    assert.equal(await b.ev(`document.querySelector("meta[name=theme-color]").content`), "#1f212b");
  });
  test("AC-04 switch back to Light without page refresh", async () => {
    await b.ev(CLICK("theme-toggle"));
    assert.equal(await isDark(), false); assert.equal(await b.ev(`window.__noReload`), 1);
    assert.equal(await b.ev(`getComputedStyle(document.body).backgroundColor`), BG.light);
    assert.equal(await b.ev(`document.getElementById("theme-toggle").getAttribute("aria-label")`), "Switch to dark theme");
  });
  test("AC-05 dark persists across reload and is stored under localStorage key theme", async () => {
    await b.ev(CLICK("theme-toggle"));
    assert.equal(await b.ev(`localStorage.getItem("theme")`), "dark");
    await b.reload(); await ready();
    assert.equal(await isDark(), true); assert.equal(await text("#theme-toggle-text"), "Light mode");
  });
  test("AC-05 light persists across reload", async () => {
    await b.ev(CLICK("theme-toggle"));
    assert.equal(await b.ev(`localStorage.getItem("theme")`), "light");
    await b.reload(); await ready(); assert.equal(await isDark(), false);
  });
  test("AC-05 survives multiple toggles then reload", async () => {
    for (let i = 0; i < 5; i++) await b.ev(CLICK("theme-toggle"));
    await b.reload(); await ready(); assert.equal(await isDark(), true);
  });
  test("invalid stored value falls back to Light", async () => {
    await setTheme("purple"); await ready(); assert.equal(await isDark(), false);
  });
  test("unavailable localStorage: app loads Light and toggle works for the session", async () => {
    const { identifier } = await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `Storage.prototype.getItem = function(){ throw new Error("blocked"); }; Storage.prototype.setItem = function(){ throw new Error("blocked"); };` });
    await b.reload(); await ready();
    assert.equal(await isDark(), false);
    await b.ev(CLICK("theme-toggle")); assert.equal(await isDark(), true);
    assert.equal(await b.ev(`document.querySelectorAll("#expense-rows tr").length`), 3, "app still functional");
    await b.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
    await b.ev(`localStorage.clear()`); await b.reload(); await ready();
  });
  test("toggling theme keeps filters and data intact", async () => {
    await selectVal("category-filter", "Food"); await ready();
    await b.ev(CLICK("theme-toggle"));
    assert.equal(await b.ev(`document.getElementById("category-filter").value`), "Food");
    assert.equal(await b.ev(`document.querySelectorAll("#expense-rows tr").length`), 2);
    await b.ev(CLICK("reset-filters")); await ready();
    await b.ev(`localStorage.clear()`); await b.reload(); await ready();
  });
});

describe("Keyboard accessibility (AC-08)", opts, () => {
  test("toggle reachable with Tab, activates with Enter and Space, shows focus outline", async () => {
    await b.ev(`localStorage.clear()`); await b.reload(); await ready();
    await b.ev(`document.activeElement.blur(); document.body.focus()`);
    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) { await b.tab(); reached = await b.ev(`document.activeElement.id === "theme-toggle"`); }
    assert.ok(reached, "toggle never received focus by Tab");
    const outline = await b.ev(`getComputedStyle(document.activeElement).outlineStyle + " " + getComputedStyle(document.activeElement).outlineWidth`);
    assert.match(outline, /solid 3px|auto/);
    await b.enter(); assert.equal(await isDark(), true, "Enter");
    await b.space(); assert.equal(await isDark(), false, "Space");
  });
  test("accessible name present and changes with state", async () => {
    const n1 = await b.ev(`document.getElementById("theme-toggle").getAttribute("aria-label")`);
    await b.ev(CLICK("theme-toggle"));
    const n2 = await b.ev(`document.getElementById("theme-toggle").getAttribute("aria-label")`);
    assert.ok(n1 && n2 && n1 !== n2); await b.ev(CLICK("theme-toggle"));
  });
  test("skip link is first focusable element", async () => {
    await b.reload(); await ready(); await b.tab();
    assert.equal(await b.ev(`document.activeElement.className`), "skip-link");
  });
  test("Escape closes the expense dialog and focus returns to opener", async () => {
    await b.ev(`document.getElementById("add-expense").focus(); ${CLICK("add-expense")}`);
    assert.equal(await b.ev(`document.getElementById("expense-dialog").open`), true);
    await b.key("Escape", "Escape", 27); await b.until(`!document.getElementById("expense-dialog").open`);
    assert.equal(await b.ev(`document.activeElement.id`), "add-expense");
  });
});

for (const theme of ["light", "dark"]) {
  describe(`Expense features regression - ${theme} theme (AC-09)`, opts, () => {
    before(async () => { await seed(); await b.viewport(1280, 900); await setTheme(theme); await ready(); });
    test("theme applied", async () => assert.equal(await isDark(), theme === "dark"));
    test("summary totals, count, average, top category", async () => {
      assert.equal(await text("#total-spent"), "35.35"); assert.equal(await text("#transaction-count"), "3");
      assert.equal(await text("#average-expense"), "11.78"); assert.equal(await text("#top-category"), "Food");
    });
    test("transactions listed newest first", async () => {
      const r = await rows(); assert.equal(r.length, 3); assert.match(r[0], /Bus|Dinner/); assert.match(r[2], /Lunch/);
    });
    test("charts render one bar per day and one row per category", async () => {
      assert.equal(await b.ev(`document.querySelectorAll("#daily-chart .day-bar").length`), 2);
      assert.equal(await b.ev(`document.querySelectorAll("#category-chart .category-row").length`), 2);
    });
    test("category filter updates rows, total and charts", async () => {
      await selectVal("category-filter", "Transport"); await ready();
      assert.equal(await text("#total-spent"), "5.05"); assert.equal((await rows()).length, 1);
      assert.equal(await isDark(), theme === "dark");
    });
    test("reset filters restores all rows", async () => {
      await b.ev(CLICK("reset-filters")); await ready(); assert.equal((await rows()).length, 3);
    });
    test("month filter with no data shows empty state", async () => {
      await b.ev(`(() => { const m = document.getElementById("month-filter"); m.value = "2020-01"; m.dispatchEvent(new Event("change")); })()`); await ready();
      assert.equal(await b.ev(`document.getElementById("empty-state").hidden`), false); assert.equal(await text("#total-spent"), "0.00");
      await b.ev(CLICK("reset-filters")); await ready();
    });
    for (const bad of ["abc", "0", "0.00", "1.234", "-5", ""]) {
      test(`UI validation rejects amount "${bad}"`, async () => {
        await b.ev(CLICK("add-expense"));
        await fill({ amount: bad, category: "Food", description: "x" });
        await b.ev(CLICK("save-expense"));
        assert.equal(await b.ev(`document.getElementById("expense-dialog").open`), true, "dialog must stay open");
        assert.equal((await rows()).length, 3);
        await b.ev(CLICK("cancel-expense"));
      });
    }
    test("add expense via dialog", async () => {
      await b.ev(CLICK("add-expense"));
      await fill({ amount: "9.99", category: "Health", description: "Vitamins" });
      await b.ev(CLICK("save-expense"));
      await b.until(`!document.getElementById("expense-dialog").open`); await ready(); await b.until(`document.querySelectorAll("#expense-rows tr").length === 4`);
      assert.equal(await text("#total-spent"), "45.34"); assert.match(await text("#notice"), /Expense added/);
      assert.ok((await rows()).some((r) => r.includes("Vitamins|Health")));
    });
    test("edit expense via dialog prefilled with existing values", async () => {
      await rowBtn("Edit Vitamins");
      assert.equal(await b.ev(`document.getElementById("amount").value`), "9.99");
      await fill({ amount: "11.00", description: "Vitamins C" });
      await b.ev(CLICK("save-expense"));
      await b.until(`document.querySelector("#total-spent").textContent === "46.35"`);
      assert.match(await text("#notice"), /Expense updated/); assert.ok((await rows()).some((r) => r.includes("Vitamins C|Health")));
    });
    test("delete requires confirmation; Keep expense cancels", async () => {
      await rowBtn("Delete Vitamins C"); await b.ev(CLICK("cancel-delete")); assert.equal((await rows()).length, 4);
    });
    test("delete expense after confirmation", async () => {
      await rowBtn("Delete Vitamins C"); await b.ev(CLICK("confirm-delete"));
      await b.until(`document.querySelectorAll("#expense-rows tr").length === 3`); assert.equal(await text("#total-spent"), "35.35");
    });
    test("markup in description is rendered as text (no XSS)", async () => {
      await api("POST", "/api/expenses", { amount: "1.00", category: "Other", description: "<img src=x onerror=window.__xss=1>", date: D(3) });
      await b.ev(CLICK("refresh")); await ready();
      assert.equal(await b.ev(`document.querySelectorAll("#expense-rows img").length`), 0); assert.equal(await b.ev(`window.__xss`), undefined);
      const id = (await api("GET", "/api/expenses")).json.expenses.find((e) => e.category === "Other").id; await api("DELETE", "/api/expenses/" + id);
    });
    test("data persists across reload (server-side store)", async () => {
      await b.reload(); await ready(); assert.equal((await rows()).length, 3);
    });
    test("API failure shows visible error notice", async () => {
      await b.ev(`window.__f = window.fetch; window.fetch = () => Promise.reject(new Error("offline"))`);
      await b.ev(CLICK("refresh")); await b.until(`!document.getElementById("notice").hidden`);
      assert.match(await text("#notice"), /Could not load expenses/); await b.ev(`window.fetch = window.__f`);
    });
  });
}

for (const theme of ["light", "dark"]) {
  describe(`Theme consistency and contrast - ${theme} (AC-06, AC-07)`, opts, () => {
    before(async () => { await seed(); await b.viewport(1280, 900); await setTheme(theme); await ready(); });
    test("no component keeps a hard-coded white/light surface in dark theme", async () => {
      const bad = await b.ev(`[...document.querySelectorAll(".stat-card,.panel,.topbar,.filter-bar input,.filter-bar select,.subtle,thead th,.theme-toggle")].filter(e => e.getClientRects().length).map(e => [e.className || e.tagName, getComputedStyle(e).backgroundColor]).filter(([, c]) => (c.match(/[0-9]+/g) || [0, 0, 0]).slice(0, 3).every((n) => Number(n) > 200))`);
      if (theme === "dark") assert.deepEqual(bad, []);
    });
    test("dialogs follow the theme", async () => {
      await b.ev(CLICK("add-expense"));
      const bg = await b.ev(`getComputedStyle(document.getElementById("expense-dialog")).backgroundColor`);
      await b.ev(CLICK("cancel-expense"));
      assert.equal(bg, theme === "dark" ? "rgb(48, 50, 64)" : "rgb(255, 255, 255)");
    });
    test("page text meets WCAG AA contrast", async () => {
      const bad = await b.ev(SCAN); assert.deepEqual(bad, [], "low contrast: " + JSON.stringify(bad));
    });
    test("expense dialog text meets WCAG AA contrast", async () => {
      await b.ev(CLICK("add-expense"));
      const bad = await b.ev(SCAN); await b.ev(CLICK("cancel-expense"));
      assert.deepEqual(bad, [], "low contrast: " + JSON.stringify(bad));
    });
    test("delete dialog text meets WCAG AA contrast", async () => {
      await b.ev(`document.querySelector("#expense-rows .row-action.delete").click()`);
      const bad = await b.ev(SCAN); await b.ev(CLICK("cancel-delete"));
      assert.deepEqual(bad, [], "low contrast: " + JSON.stringify(bad));
    });
    test("form error text is legible", async () => {
      await b.ev(CLICK("add-expense")); await fill({ amount: "abc", category: "x", description: "x" });
      await b.ev(CLICK("save-expense"));
      const bad = await b.ev(SCAN); await b.ev(CLICK("cancel-expense"));
      assert.deepEqual(bad.filter((x) => /form-error/.test(x.el)), []);
    });
  });
}

describe("Sidebar and responsiveness", opts, () => {
  for (const theme of ["light", "dark"]) {
    for (const w of [320, 375, 480, 768, 900, 1024, 1280, 1920]) {
      test(`${theme} @${w}px: no horizontal overflow, toggle reachable and not covered`, async () => {
        await b.viewport(w, 900); await setTheme(theme); await ready();
        const r = await b.ev(`(() => { const t = document.getElementById("theme-toggle"); const r = t.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { overflow: document.documentElement.scrollWidth - innerWidth, inView: r.width > 0 && r.left >= 0 && r.right <= innerWidth, hit: t.contains(hit) }; })()`);
        assert.ok(r.overflow <= 0, "horizontal overflow " + r.overflow + "px"); assert.ok(r.inView, "toggle outside viewport"); assert.ok(r.hit, "toggle covered by another element");
      });
    }
    for (const [w, expect] of [[1280, "full"], [900, "icons"], [480, "bar"]]) {
      test(`${theme} @${w}px: sidebar visible with nav links (${expect})`, async () => {
        await b.viewport(w, 900); await setTheme(theme); await ready();
        const s = await b.ev(`(() => { const e = document.querySelector(".sidebar"); const r = e.getBoundingClientRect(); const items = [...document.querySelectorAll(".nav-item")].map(n => { const q = n.getBoundingClientRect(); return q.width > 0 && q.height > 0; });
          return { w: Math.round(r.width), h: Math.round(r.height), pos: getComputedStyle(e).position, items, label: getComputedStyle(document.querySelector(".nav-label")).display }; })()`);
        assert.ok(s.items.length === 3 && s.items.every(Boolean), JSON.stringify(s));
        if (expect === "full") assert.ok(s.w >= 220 && s.pos === "fixed" && s.label !== "none", JSON.stringify(s));
        if (expect === "icons") assert.ok(s.w <= 80, JSON.stringify(s));
        if (expect === "bar") assert.ok(s.w >= 440 && s.h <= 70, JSON.stringify(s));
      });
    }
    test(`${theme}: sidebar background differs from page background`, async () => {
      await b.viewport(1280, 900); await setTheme(theme); await ready();
      const [s, m] = await b.ev(`[getComputedStyle(document.querySelector(".sidebar")).backgroundColor, getComputedStyle(document.body).backgroundColor]`); assert.notEqual(s, m);
    });
  }
  test("sidebar nav link anchors to Transactions section", async () => {
    await b.viewport(1280, 900); await setTheme("light"); await ready();
    await b.ev(`document.querySelector("a.nav-item[href$=transactions]").click()`); assert.equal(await b.ev(`location.hash`), "#transactions");
  });
  test("expense dialog fits at 320px width in dark theme", async () => {
    await b.viewport(320, 640); await setTheme("dark"); await ready(); await b.ev(CLICK("add-expense"));
    const r = await b.ev(`(() => { const r = document.getElementById("expense-dialog").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })()`);
    await b.ev(CLICK("cancel-expense")); assert.ok(r);
  });
});
