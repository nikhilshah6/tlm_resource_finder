// Unit check for the ranker's Act today post-processing (site/functions/_agent/stages.ts), no API key needed:
// a made-up model response goes in, and we check contacts come from the record, benefits steps are dropped, and model-written numbers are removed.
// Run: cd site && npm install && cd .. && node tests/act-today-unit.mjs
import { build } from "../site/node_modules/esbuild/lib/main.js";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
const here = fileURLToPath(new URL(".", import.meta.url)), out = join(tmpdir(), "tlm-stages-" + process.pid + ".mjs");
await build({ entryPoints: [join(here, "../site/functions/_agent/stages.ts")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
const { actTodaySteps } = await import(out);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "  ok   " : "  FAIL ") + m); };
const keep = [
  { name: "BOSS", phone: "(510) 649-1930", url: "https://self-sufficiency.org/", address: "1918 University Ave" },
  { name: "Clinic with no contact" },
  { name: "CalFresh (apply via GetCalFresh)", phone: "(877) 847-3663", url: "https://www.getcalfresh.org/" },
  { name: "Listing only", source_url: "https://ebho.org/x" },
];
const steps = actTodaySteps([
  { title: "Call BOSS about a backup bed (510) 555-9999", how: "call", resource_index: 0, bullets: ["a", "b", "c", "d"], for_alumnus_title: "Call BOSS" },
  { title: "Apply for CalFresh and Medi-Cal", how: "apply_online", resource_index: 2, for_alumnus_title: "Apply" },
  { title: "Visit the clinic", how: "visit", resource_index: 1, for_alumnus_title: "Go to the clinic" },
  { title: "Call the listing", how: "call", resource_index: 3, for_alumnus_title: "Call" },
  { title: "Fourth real step", how: "call", resource_index: 0, for_alumnus_title: "x" },
], keep);
ok(steps.length === 3 && !steps.some((x) => /calfresh|medi-cal/i.test(x.title)), "at most 3 steps; CalFresh/Medi-Cal steps are dropped (they come from the tiles)");
ok(steps[0].phone === "(510) 649-1930" && steps[0].url === "https://self-sufficiency.org/", "phone and url come from the program's record");
ok(steps[0].title === "Call BOSS about a backup bed", "a number the model wrote is removed from the text");
ok(steps[0].bullets.length === 3, "bullets are capped at 3");
ok(steps[1].missing_contact === true && !steps[1].phone && !steps[1].url, "a step with no phone and no link is flagged");
ok(steps[2].url === "https://ebho.org/x" && !steps[2].missing_contact, "with no phone or website, the source listing is the link");
const t2 = actTodaySteps([{ title: "Go to www.x.org or call 1-800-555-1212 today", how: "visit", resource_index: 0, for_alumnus_title: "Visit https://x.org/a" }], keep)[0];
ok(!/www|http|\d{3}/.test(t2.title + t2.for_alumnus_title), "web addresses and 1-800 numbers are removed too");
console.log(`\nact today unit: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
