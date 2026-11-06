/* cf-shim.js: loaded first on the Cloudflare-hosted copy of the hub.
 * 1. Provides window.claude.use("sample") backed by the site's /api/claude proxy, so the case manager code
 *    (briefings, notes drafts) runs unchanged outside claude.ai. db/user resolve to null, which the code already handles.
 * 2. Sends the hub's direct calls to api.anthropic.com through /api/claude instead, so no API key is in the browser.
 * Does nothing inside a claude.ai artifact, where window.claude already exists.
 */
(function () {
  if (window.claude) return;
  var origFetch = window.fetch.bind(window);
  var API = "/api/claude";
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input && input.url;
    if (url && /^https:\/\/api\.anthropic\.com\/v1\/messages/.test(url)) {
      var i = Object.assign({}, init || {}); i.headers = { "content-type": "application/json" };
      return origFetch(API, i);
    }
    return origFetch(input, init);
  };
  var TIER = { quick: "claude-haiku-5-5", default: "claude-opus-5-5", complex: "claude-opus-5-5" };
  function toMessages(input) { return typeof input === "string" ? [{ role: "user", content: input }] : input; }
  function ask(input, o) {
    o = o || {};
    var body = { model: o.model || TIER[o.modelTier || "default"] || TIER["default"], max_tokens: o.maxTokens || 8000, messages: toMessages(input) };
    if (o.effort) body.output_config = { effort: o.effort };
    return origFetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: o.signal })
      .catch(function (e) { throw { code: e && e.name === "AbortError" ? "cancelled" : "network", message: String(e && e.message || e) }; })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw { code: r.status === 429 ? "rate_limited" : "unavailable", message: (j && j.error && j.error.message) || ("HTTP " + r.status) };
          var text = (j.content || []).filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("");
          if (o.onText) try { o.onText({ text: text, delta: text }); } catch (e) {}
          return { text: text, truncated: j.stop_reason === "max_tokens", modelApplied: j.model };
        });
      });
  }
  function parseJson(text) {
    var t = String(text || "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    try { return JSON.parse(t); } catch (e) {}
    var a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    throw { code: "invalid_json", message: "The answer wasn't valid JSON.", text: text };
  }
  var sample = function (input, o) { return ask(input, o); };
  sample.json = function (input, o) { return ask(input, o).then(function (r) { return parseJson(r.text); }); };
  sample.limits = function () { return Promise.resolve({ modelTiers: ["quick", "default", "complex"] }); };
  window.claude = { use: function (name) { return Promise.resolve(name === "sample" ? sample : null); }, hosted: "cloudflare" };
})();
