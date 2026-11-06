// Builds the Cloudflare Pages output in site/public from the standalone demo (demo/).
// - copies demo/index.html (adds cf-shim.js in the head) and the scripts and stylesheet it loads
// - copies the checked-in state application links (site/data/state-links.json)
// - turns HRSA's health center file into small per-state JSON files (pass a local CSV path, or it downloads it)
// Usage: node build.js [path/to/Health_Center_Service_Delivery_and_LookAlike_Sites.csv]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const out = path.join(here, "public");
fs.mkdirSync(path.join(out, "data", "hrsa"), { recursive: true });

// 1. page + scripts: the standalone demo (demo/index.html). Files resolve from demo/ first, then the repo root.
const demo = path.join(root, "demo");
let html = fs.readFileSync(path.join(demo, "index.html"), "utf8");
const at = html.indexOf("</head>");
if (at < 0) throw new Error("no </head> in demo page");
html = html.slice(0, at) + '<script src="cf-shim.js"></script>\n' + html.slice(at);
fs.writeFileSync(path.join(out, "index.html"), html);
const resolve = (f) => [path.join(demo, f), path.join(root, f)].find((p) => fs.existsSync(p)) || (() => { throw new Error("missing file: " + f); })();
const scripts = [...html.matchAll(/<script src="([^"]+\.js)"><\/script>/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s) && s !== "cf-shim.js");
const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)">/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
scripts.concat(styles).forEach((s) => fs.copyFileSync(resolve(s), path.join(out, s)));
fs.copyFileSync(path.join(here, "src", "cf-shim.js"), path.join(out, "cf-shim.js"));

// 2. state application links: checked in at site/data/state-links.json (extracted once from the hub's STATE_F30 / F30_NAT)
fs.copyFileSync(path.join(here, "data", "state-links.json"), path.join(out, "data", "state-links.json"));
const links = JSON.parse(fs.readFileSync(path.join(here, "data", "state-links.json"), "utf8"));
// California directory snapshot and eligibility rules used by the AI deep search (/api/agent/step), built by scripts/build_agent_data.py
fs.cpSync(path.join(here, "data", "agent"), path.join(out, "data", "agent"), { recursive: true });

// 3. HRSA health centers -> per-state compact JSON
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
async function hrsa() {
  const src = process.argv[2];
  const text = src ? fs.readFileSync(src, "utf8") : await (await fetch("https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv", { headers: { "User-Agent": "TLM-reentry-hub-prototype/0.1" } })).text();
  const rows = parseCsv(text), h = rows[0], col = (n) => h.indexOf(n);
  const ix = { n: col("Site Name"), a: col("Site Address"), c: col("Site City"), s: col("Site State Abbreviation"), z: col("Site Postal Code"), p: col("Site Telephone Number"), w: col("Site Web Address"), hrs: col("Operating Hours per Week"), status: col("Site Status Description"), x: col("Geocoding Artifact Address Primary X Coordinate"), y: col("Geocoding Artifact Address Primary Y Coordinate"), id: col("BPHC Assigned Number") };
  if (Object.values(ix).some((v) => v < 0)) throw new Error("HRSA columns changed: " + JSON.stringify(ix));
  const by = {};
  rows.slice(1).forEach((r, k) => {
    if (r.length <= ix.y || r[ix.status] !== "Active") return;
    const x = Number(r[ix.x]), y = Number(r[ix.y]); if (!x || !y) return;
    (by[r[ix.s]] = by[r[ix.s]] || []).push({ i: r[ix.id] || String(k), n: r[ix.n], a: [r[ix.a], r[ix.c], r[ix.s], String(r[ix.z]).slice(0, 5)].join(", "), p: r[ix.p] || null, w: r[ix.w] || null, h: Number(r[ix.hrs]) || null, x, y });
  });
  Object.entries(by).forEach(([st, list]) => fs.writeFileSync(path.join(out, "data", "hrsa", st + ".json"), JSON.stringify(list)));
  return Object.values(by).reduce((s, l) => s + l.length, 0);
}
const n = await hrsa();
console.log("built site/public:", scripts.length, "scripts,", Object.keys(links.states).length, "states with links,", n, "active health center sites");
