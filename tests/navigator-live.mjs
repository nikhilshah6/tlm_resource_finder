// Live check of the resource sources (real network). Run after `node site/build.js`: node tests/navigator-live.mjs [zip ...]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { findResources, NEEDS } from "../site/lib/resources.js";
const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "site", "public");
const env = { ASSETS: { fetch: async (req) => { const p = path.join(pub, new URL(req.url).pathname); return fs.existsSync(p) ? new Response(fs.readFileSync(p)) : new Response("", { status: 404 }); } } };
const links = JSON.parse(fs.readFileSync(path.join(pub, "data", "state-links.json"), "utf8"));
const zips = process.argv.slice(2).length ? process.argv.slice(2) : ["94607", "95814", "77002"];
let bad = 0;
for (const zip of zips) {
  const r = await findResources({ zip, needs: NEEDS, env, links });
  const by = {}; r.items.forEach((i) => { (by[i.need] = by[i.need] || []).push(i); });
  console.log(`\n${zip} ${r.geo.city}, ${r.geo.state} (${r.geo.county}) · ${r.items.length} items · errors: ${JSON.stringify(r.errors)}`);
  for (const n of NEEDS) { const l = by[n] || []; console.log(`  ${n.padEnd(9)} ${String(l.length).padStart(2)}  ${l.slice(0, 2).map((i) => i.name + (i.distanceMi != null ? " (" + i.distanceMi + " mi)" : "")).join(" | ")}`); if (!l.length) bad++; }
  const leak = JSON.stringify(r).match(/Marcus|Johnson|parole officer/i); if (leak) { console.log("  LEAK", leak[0]); bad++; }
}
console.log(bad ? `\n${bad} gaps` : "\nevery need area has at least one resource"); process.exit(0);
