// Aggregates resources for a ZIP and a list of needs. Pure orchestration so it can be unit tested with a mocked fetch.
import { zipLookup } from "./geo.js";
import { ssaOffices, housingAuthorities, housingCounselors, treatment, healthCenters } from "./sources/live.js";
import { NATIONAL, stateLinks } from "./sources/curated.js";

export const NEEDS = ["id", "ssn", "snap", "medicaid", "phone", "bank", "vote", "records", "housing", "shelter", "jobs", "training", "health", "treatment", "legal"];

// which live connectors serve which needs
const LIVE = [
  { name: "ssa", needs: ["ssn", "id"], run: (g, f) => ssaOffices(g, f) },
  { name: "housingAuthorities", needs: ["housing", "shelter"], run: (g, f) => housingAuthorities(g, f) },
  { name: "housingCounselors", needs: ["housing", "shelter"], run: (g, f) => housingCounselors(g, f) },
  { name: "treatment", needs: ["treatment"], run: (g, f) => treatment(g, f) },
  { name: "healthCenters", needs: ["health", "medicaid"], run: (g, f, env) => healthCenters(g, env) }
];

export async function findResources({ zip, needs, env, fetchFn = fetch, links }) {
  const want = (needs && needs.length ? needs : NEEDS).filter((n) => NEEDS.includes(n));
  const geo = await zipLookup(zip, fetchFn);
  const errors = [], items = [];
  const jobs = LIVE.filter((c) => c.needs.some((n) => want.includes(n))).map((c) =>
    c.run(geo, fetchFn, env).then((rows) => rows.forEach((r) => items.push(r))).catch((e) => errors.push({ source: c.name, message: String(e.message || e) })));
  await Promise.all(jobs);
  stateLinks(geo, links || { states: {}, national: {} }).forEach((r) => items.push(r));
  NATIONAL.forEach((r) => items.push(Object.assign({}, r)));
  // keep items for the needs asked for; ssa also serves "id" only as a supporting document step
  const out = items.filter((r) => want.includes(r.need) || (r.need === "ssn" && want.includes("id")) || (r.need === "health" && want.includes("medicaid") && r.kind === "health-center"));
  const seen = new Set();
  return { geo, items: out.filter((r) => (seen.has(r.id) ? false : seen.add(r.id))), errors, needs: want, generatedAt: new Date().toISOString() };
}
