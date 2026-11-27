"use strict";
// Shared test harness (Node built-ins only). Starts the Java server in an ISOLATED temp dir
// (copy of src/static, a patched COPY of web.java using a free port, own expenses-java.json)
// so the real data file and any running instance on port 8000 are never touched.
// Drives headless Microsoft Edge through the Chrome DevTools Protocol (no npm deps).
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.TEST_PORT || 8123);
const BASE = "http://127.0.0.1:" + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findEdge() {
  const c = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe"];
  return c.find((p) => fs.existsSync(p)) || null;
}

function getJson(url, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); });
    req.on("error", reject); req.end();
  });
}

async function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "expense-test-"));
  fs.cpSync(path.join(ROOT, "src", "static"), path.join(dir, "src", "static"), { recursive: true });
  const srcText = fs.readFileSync(path.join(ROOT, "src", "web.java"), "utf8");
  if (!srcText.includes("8000")) throw new Error("Port constant not found in web.java");
  fs.writeFileSync(path.join(dir, "web.java"), srcText.replace("8000", String(PORT)));
  const proc = spawn("java", [path.join(dir, "web.java")], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; proc.stdout.on("data", (d) => (log += d)); proc.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    if (/Expense Tracker: http/.test(log)) break;
    if (proc.exitCode !== null) throw new Error("Server exited: " + log);
    await sleep(250);
  }
  if (!/Expense Tracker: http/.test(log)) throw new Error("Server did not start: " + log);
  return { dir, store: path.join(dir, "expenses-java.json"), stop() { try { execFileSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { proc.kill(); } } };
}

async function api(method, p, body, headers = {}) {
  const res = await fetch(BASE + p, { method, headers: { "X-Expense-Request": "1", ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch (e) { /* non-JSON */ }
  return { status: res.status, json };
}

async function clearAll() {
  const r = await api("GET", "/api/expenses");
  for (const e of r.json.expenses) await api("DELETE", "/api/expenses/" + e.id);
}

/** Minimal CDP browser wrapper. */
async function launchBrowser(edge, port = 9333) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "edge-profile-"));
  const proc = spawn(edge, ["--headless=new", "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "--no-first-run", "--disable-gpu", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  let ver; for (let i = 0; i < 60; i++) { try { ver = await getJson("http://127.0.0.1:" + port + "/json/version"); break; } catch (e) { await sleep(250); } }
  if (!ver) { proc.kill(); throw new Error("Browser did not start"); }
  const tab = await getJson("http://127.0.0.1:" + port + "/json/new?about:blank", "PUT");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const waiters = [];
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); } else if (msg.method) waiters.slice().forEach((w) => w(msg)); };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  const onLoad = () => new Promise((r) => { const w = (m) => { if (m.method === "Page.loadEventFired") { waiters.splice(waiters.indexOf(w), 1); r(); } }; waiters.push(w); });
  const b = {
    send,
    async goto(url) { const loaded = onLoad(); await send("Page.navigate", { url }); await loaded; await sleep(300); },
    async reload() { const loaded = onLoad(); await send("Page.reload"); await loaded; await sleep(300); },
    /** Evaluate a JS expression string in the page (awaits promises). */
    async ev(expr) { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return r.result.value; },
    async viewport(width, height = 900) { await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }); await sleep(150); },
    async key(key, code, vk) { const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }; await send("Input.dispatchKeyEvent", { type: "keyDown", ...base, ...(key === " " ? { text: " " } : key === "Enter" ? { text: "\r" } : {}) }); await send("Input.dispatchKeyEvent", { type: "keyUp", ...base }); await sleep(80); },
    tab() { return b.key("Tab", "Tab", 9); }, enter() { return b.key("Enter", "Enter", 13); }, space() { return b.key(" ", "Space", 32); },
    async until(expr, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { if (await b.ev(expr)) return true; await sleep(100); } return false; },
    async close() { try { ws.close(); } catch (e) {} try { execFileSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { proc.kill(); } await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} },
  };
  return b;
}

/** WCAG contrast helpers (rgb arrays). */
function lum(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
function ratio(a, b) { const s = [lum(a), lum(b)].sort((p, q) => q - p); return (s[0] + 0.05) / (s[1] + 0.05); }
function hex(h) { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }

module.exports = { ROOT, BASE, PORT, sleep, findEdge, startServer, api, clearAll, launchBrowser, ratio, hex };
