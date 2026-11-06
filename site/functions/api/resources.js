// GET /api/resources?zip=94607&needs=id,snap,housing
// Only the ZIP and need categories arrive here; no names or case details.
import { findResources, NEEDS } from "../../lib/resources.js";

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: Object.assign({ "content-type": "application/json; charset=utf-8" }, extra) });

export async function onRequestGet({ request, env, waitUntil }) {
  const u = new URL(request.url);
  const zip = (u.searchParams.get("zip") || "").trim();
  const needs = (u.searchParams.get("needs") || "").split(",").map((s) => s.trim()).filter((n) => NEEDS.includes(n)).sort();
  if (!/^\d{5}$/.test(zip)) return json({ error: "Enter a 5-digit ZIP code." }, 400);
  const cacheKey = new Request(`https://cache.local/resources?zip=${zip}&needs=${needs.join(",")}`);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return hit; }
  let links = { states: {}, national: {} };
  try { const r = await env.ASSETS.fetch(new Request("https://assets.local/data/state-links.json")); if (r.ok) links = await r.json(); } catch (e) {}
  try {
    const result = await findResources({ zip, needs, env, links });
    const res = json(result, 200, { "cache-control": "public, max-age=86400" });
    if (cache) waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return json({ error: String(e.message || e) }, /ZIP/.test(String(e.message)) ? 404 : 502);
  }
}
