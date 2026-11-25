"use strict";
// Backend/API tests: expense CRUD, validation, filtering, totals, persistence (Java server, isolated temp store).
const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { startServer, api, clearAll, BASE } = require("./helpers");

let srv;
before(async () => { srv = await startServer(); });
after(() => srv && srv.stop());
const good = { amount: "12.50", category: "Food", description: "Lunch", date: "2026-11-10" };

describe("Expense CRUD", () => {
  test("starts empty with zero totals", async () => {
    const r = await api("GET", "/api/expenses");
    assert.equal(r.status, 200); assert.deepEqual(r.json.expenses, []); assert.equal(Number(r.json.summary.total_cents), 0);
  });
  test("add expense returns 201 and appears in list", async () => {
    assert.equal((await api("POST", "/api/expenses", good)).status, 201);
    const l = await api("GET", "/api/expenses");
    assert.equal(l.json.expenses.length, 1); assert.equal(l.json.expenses[0].description, "Lunch");
  });
  test("edit expense updates fields", async () => {
    const id = (await api("GET", "/api/expenses")).json.expenses[0].id;
    const r = await api("PUT", "/api/expenses/" + id, { ...good, amount: "20.00", description: "Dinner" });
    assert.equal(r.status, 200);
    const e = (await api("GET", "/api/expenses")).json.expenses[0];
    assert.equal(e.description, "Dinner"); assert.equal(Number(e.amount_cents), 2000);
  });
  test("delete expense removes it; second delete is rejected", async () => {
    const id = (await api("GET", "/api/expenses")).json.expenses[0].id;
    assert.equal((await api("DELETE", "/api/expenses/" + id)).status, 200);
    assert.equal((await api("GET", "/api/expenses")).json.expenses.length, 0);
    assert.equal((await api("DELETE", "/api/expenses/" + id)).status, 400);
  });
  test("unsupported method/path returns 405", async () => {
    assert.equal((await api("PATCH", "/api/expenses")).status, 405);
  });
});

describe("Validation", () => {
  for (const [name, patch] of [
    ["negative amount", { amount: "-5" }], ["zero amount", { amount: "0" }], ["zero decimals", { amount: "0.00" }],
    ["three decimals", { amount: "1.234" }], ["non-numeric amount", { amount: "abc" }], ["empty amount", { amount: "" }],
    ["empty category", { category: "" }], ["empty description", { description: "" }], ["invalid date", { date: "2026-13-45" }],
    ["empty date", { date: "" }], ["category > 80 chars", { category: "x".repeat(81) }], ["description > 500 chars", { description: "x".repeat(501) }],
  ]) {
    test("rejects " + name, async () => {
      const r = await api("POST", "/api/expenses", { ...good, ...patch });
      assert.equal(r.status, 400, JSON.stringify(r.json)); assert.ok(r.json.error);
    });
  }
  test("request without X-Expense-Request header is rejected (CSRF guard)", async () => {
    const r = await fetch(BASE + "/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(good) });
    assert.ok([400, 403].includes(r.status), "status " + r.status);
    await clearAll();
  });
  test("markup in description is accepted by API (escaping is UI concern)", async () => {
    assert.equal((await api("POST", "/api/expenses", { ...good, description: "<b>x</b>" })).status, 201); await clearAll();
  });
});

describe("Filtering and totals", () => {
  before(async () => {
    await clearAll();
    for (const e of [
      { amount: "10.10", category: "Food", description: "a", date: "2026-11-01" },
      { amount: "20.20", category: "Food", description: "b", date: "2026-11-02" },
      { amount: "5.05", category: "Transport", description: "c", date: "2026-11-02" },
      { amount: "100.00", category: "Bills", description: "d", date: "2026-10-15" },
    ]) assert.equal((await api("POST", "/api/expenses", e)).status, 201);
  });
  test("month filter", async () => {
    const r = (await api("GET", "/api/expenses?month=2026-11")).json;
    assert.equal(r.expenses.length, 3); assert.equal(Number(r.summary.total_cents), 3535);
  });
  test("category filter is case-insensitive", async () => {
    assert.equal((await api("GET", "/api/expenses?category=food")).json.expenses.length, 2);
  });
  test("month + category combined", async () => {
    const r = (await api("GET", "/api/expenses?month=2026-10&category=Bills")).json;
    assert.equal(r.expenses.length, 1); assert.equal(Number(r.summary.total_cents), 10000);
  });
  test("no filter returns all with exact decimal total", async () => {
    const r = (await api("GET", "/api/expenses")).json; assert.equal(Number(r.summary.total_cents), 13535); assert.equal(Number(r.summary.count), 4);
  });
  test("filter with no matches yields empty summary", async () => {
    const r = (await api("GET", "/api/expenses?month=2020-01")).json; assert.equal(r.expenses.length, 0); assert.equal(Number(r.summary.total_cents), 0);
  });
  test("categories list and by_category breakdown", async () => {
    const r = (await api("GET", "/api/expenses")).json;
    assert.deepEqual([...r.categories].sort(), ["Bills", "Food", "Transport"]);
    assert.equal(Number(r.summary.by_category.find((c) => c.category === "Food").amount_cents), 3030);
  });
});

describe("Persistence", () => {
  test("data is written to the JSON store file", () => {
    assert.equal(JSON.parse(fs.readFileSync(srv.store, "utf8")).length, 4);
  });
  test("API response shape unchanged by theme work (regression)", async () => {
    const r = await api("GET", "/api/expenses"); assert.deepEqual(Object.keys(r.json).sort(), ["categories", "expenses", "summary"]);
  });
});
