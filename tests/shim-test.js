// Tests site/src/cf-shim.js: window.claude.use("sample") over /api/claude, and rerouting of direct api.anthropic.com calls.
const { JSDOM } = require("jsdom"); const fs = require("fs"); const path = require("path");
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
(async () => {
  const sent = []; let reply = { content: [{ type: "text", text: '```json\n{"a":1}\n```' }], stop_reason: "end_turn", model: "claude-haiku-5-5" }, status = 200;
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
  const w = dom.window;
  w.fetch = async (url, init) => { sent.push({ url: String(url), body: init && init.body ? JSON.parse(init.body) : null, headers: init && init.headers }); return { ok: status < 400, status, json: async () => reply }; };
  w.eval(fs.readFileSync(path.join(__dirname, "..", "site", "src", "cf-shim.js"), "utf8"));
  ok(w.claude && w.claude.hosted === "cloudflare", "shim installs window.claude when absent");
  const s = await w.claude.use("sample");
  ok(typeof s === "function" && (await w.claude.use("db")) === null, "sample is provided; db resolves null");
  const v = await s.json("hi", { model: "claude-haiku-5-5", modelTier: "quick", effort: "low" });
  ok(v.a === 1, "sample.json parses fenced JSON");
  ok(sent[0].url === "/api/claude" && sent[0].body.model === "claude-haiku-5-5" && sent[0].body.output_config.effort === "low" && sent[0].body.messages[0].content === "hi", "calls /api/claude with the model, effort and message");
  await s("x"); ok(sent[1].body.model === "claude-opus-5-5", "default tier maps to Claude Opus 5.5");
  await w.fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": "should-not-pass" }, body: JSON.stringify({ model: "claude-sonnet-4-6", messages: [] }) });
  ok(sent[2].url === "/api/claude" && !JSON.stringify(sent[2].headers).includes("should-not-pass"), "direct api.anthropic.com calls go to /api/claude without client headers");
  status = 429; reply = { error: { message: "slow down" } }; let code = null; try { await s("x"); } catch (e) { code = e.code; } ok(code === "rate_limited", "429 becomes rate_limited");
  status = 200; reply = { content: [{ type: "text", text: "no json here" }] }; code = null; try { await s.json("x"); } catch (e) { code = e.code; } ok(code === "invalid_json", "bad JSON becomes invalid_json");
  const d2 = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" }); d2.window.claude = { use: async () => "real" }; d2.window.fetch = async () => ({}); d2.window.eval(fs.readFileSync(path.join(__dirname, "..", "site", "src", "cf-shim.js"), "utf8"));
  ok((await d2.window.claude.use("sample")) === "real", "inside a claude.ai artifact the shim does nothing");
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
