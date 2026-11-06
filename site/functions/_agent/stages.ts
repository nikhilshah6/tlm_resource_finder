// The agent pipeline for the hub site (source of truth; app/ holds the Python reference version). Lines marked "TLM demo:" are hub-specific.
// The five agent stages. Same prompts and policies as app/pipeline.py (the Python reference).
// Each stage runs as its own function call so no single call exceeds Cloudflare's request limits;
// the browser strings them together (RXV.agentRun in demo/app.js).
import Anthropic from "@anthropic-ai/sdk";
import { Counters, Emit, OPUS, SONNET, Tool, runAgent, webTools } from "./agent";
import { Snapshot, careerOneStopAjc, fdicBranches, findTreatment, geocode, hudCounselors } from "./tools";

export const FINDER_LABELS: Record<string, string> = {
  housing: "Housing", health: "Health & recovery", food_benefits: "Food & benefits",
  jobs: "Jobs & training", legal_id: "Legal, ID & money",
};
const CATEGORIES = ["housing", "health", "food_benefits", "jobs", "legal_id", "family", "clothing"];

const SHARED_RULES = `Rules you always follow:
- The person is a FICTIONAL formerly incarcerated adult in California. Never ask for or invent personal details.
- Return only programs that appeared in a tool result or web page during THIS run, with the URL you found them at (source_url). Never write a program from memory.
- Stay in the person's county or a neighboring county unless the program is statewide, by phone, or online. If they are on parole/probation with a county restriction, stay inside that county.
- Respect supervision conditions: curfew hours, GPS charging needs, drug testing, no-contact rules.
- Prefer programs that serve people with records, are free or low cost, and are reachable without a car.
- Write in plain, respectful language (say "person returning home", not "offender").`;

const GRAY_AREA_POLICY =
  "When eligibility is uncertain, recommend the program as 'worth_applying' and state the one question to confirm. " +
  "Only mark 'not_eligible' when a written rule clearly excludes this person. Missing information is never a reason to exclude.";

const S = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });

const CANDIDATE_ITEM = {
  type: "object",
  properties: {
    name: S(), description: S("What they offer, one or two sentences"), address: S(), city: S(), county: S(),
    phone: S(), url: S(), hours: S(), who_it_serves: S(), intake_requirements: S(), cost: S(),
    source: S("snapshot, findtreatment, hud, fdic, careeronestop, hrsa, tlm, cdcr_dapo, state, county, or web"),
    source_url: S("Page or API where you found it this run"),
    distance_miles: { type: "number" }, tlm_network: { type: "boolean" },
  },
  required: ["name", "description", "source", "source_url"],
};

const PROFILE_KEYS = ["id", "display_name", "city", "county", "zip", "lat", "lon", "days_since_release", "supervision",
  "documents_held", "housing_status", "household_size", "monthly_income", "gender", "lgbtq", "children",
  "offense_categories", "insurance", "goals", "barriers", "notes"];

const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    display_name: S("A fictional first name, or 'Alumnus'"), city: S(), county: S("California county, without the word County"), zip: S(),
    days_since_release: { type: "integer" },
    supervision: { type: "object", properties: {
      type: { type: "string", enum: ["parole", "probation", "pretrial", "none", "unknown"] }, curfew: S(), gps: { type: "boolean" },
      county_restriction: S(), notes: S() } },
    documents_held: { type: "array", items: S("state_id, ssn_card, birth_certificate, ...") },
    housing_status: { type: "string", enum: ["unhoused", "shelter", "transitional", "family_or_friends", "own_place", "unknown"] },
    household_size: { type: "integer" }, monthly_income: { type: "integer" }, gender: S(), lgbtq: { type: "boolean" }, children: S(),
    offense_categories: { type: "array", items: { type: "string", enum: ["drug", "violent", "property", "sex_registration", "dui", "other"] } },
    insurance: S(), goals: { type: "array", items: S() }, barriers: { type: "array", items: S() }, notes: S(),
  },
  required: ["city", "county"],
};

export interface Ctx { client: Anthropic; emit: Emit; counters: Counters; snapshot: Snapshot; env: any }

const profileText = (p: any) => JSON.stringify(Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null && v !== undefined)), null, 1);
const pick = (o: any, keys: string[]) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));

// ------------------------------------------------------------------ 1. intake
export async function intake(ctx: Ctx, body: any) {
  const { emit } = ctx;
  await emit({ type: "agent_start", agent: "intake", message: "Reading the situation" });
  let profile: any;
  if (body.profile) {
    profile = pick(body.profile, PROFILE_KEYS);
  } else {
    const out = await runAgent({
      ...ctx, agent: "intake", model: SONNET, effort: "low",
      system: "You turn a case manager's plain-language description of a FICTIONAL formerly incarcerated person in California into a structured profile. " +
        "Infer the California county from the city. Code offense categories only as: drug, violent, property, sex_registration, dui, other. " +
        "Leave fields you don't know unset; do not guess income or offense. Then call submit.",
      user: `Situation:\n${String(body.text || "").slice(0, 4000)}`,
      submitSchema: { type: "object", properties: { profile: PROFILE_SCHEMA }, required: ["profile"] },
      submitDescription: "Submit the structured profile.",
    });
    profile = pick(out.profile ?? out, PROFILE_KEYS);
    profile.display_name ||= "Alumnus";
  }
  profile.county = String(profile.county || "").replace(/ County$/i, "");
  profile.supervision ||= { type: "unknown", gps: false };
  for (const k of ["documents_held", "offense_categories", "goals", "barriers"]) profile[k] ||= [];
  profile.household_size ||= 1;
  profile.housing_status ||= "unknown";
  if (profile.lat == null) {
    const g = await geocode(profile.zip || profile.city);
    await emit({ type: "tool_call", agent: "intake", tool: "geocode", message: `Located ${profile.city} (${profile.county} County)` });
    if (g.lat != null) { profile.lat = g.lat; profile.lon = g.lon; profile.zip ||= g.zip; }
  }
  await emit({ type: "found", agent: "intake", message: `Profile ready: ${profile.city}, ${profile.county} County`, count: 1 });
  return { profile };
}

// ------------------------------------------------------------------ 2. orchestrator
export async function orchestrate(ctx: Ctx, body: any) {
  const { emit } = ctx;
  const profile = body.profile;
  await emit({ type: "agent_start", agent: "orchestrator", message: "Ordering needs and briefing the finders" });
  const out = await runAgent({
    ...ctx, agent: "orchestrator", model: OPUS, effort: "low",
    system: "You are the lead reentry navigator for The Last Mile. Given a FICTIONAL alumnus profile in California, decide what they need most, " +
      "in order of urgency (safety, a place to sleep tonight, ID and documents, food and income, health coverage, supervision compliance, then work, legal and family). " +
      "Then write a short, specific brief for each of the five finder agents (housing, health, food_benefits, jobs, legal_id). " +
      "Every finder must get a brief, even for lower-priority needs; legal_id also covers state ID, record relief and bank accounts. " +
      "Constraints must carry supervision limits (county restriction, curfew, GPS) and practical limits (no car, no ID). Call submit.",
    user: `Profile:\n${profileText(profile)}`,
    submitSchema: {
      type: "object",
      properties: {
        needs: { type: "array", items: { type: "object", properties: {
          category: { type: "string", enum: CATEGORIES }, urgency: { type: "string", enum: ["today", "this_week", "this_month"] }, why: S() },
          required: ["category", "urgency", "why"] } },
        briefs: { type: "array", items: { type: "object", properties: {
          finder: { type: "string", enum: Object.keys(FINDER_LABELS) }, focus: S(), constraints: { type: "array", items: S() } },
          required: ["finder", "focus"] } },
      },
      required: ["needs", "briefs"],
    },
    submitDescription: "Submit the ordered needs and one brief per finder.",
  });
  const needs: any[] = [], seenN = new Set<string>();
  for (const n of out.needs || []) if (CATEGORIES.includes(n.category) && !seenN.has(n.category)) { seenN.add(n.category); needs.push(n); }
  const briefs: any[] = [], seenB = new Set<string>();
  for (const b of out.briefs || []) if (FINDER_LABELS[b.finder] && !seenB.has(b.finder)) { seenB.add(b.finder); briefs.push({ constraints: [], ...b }); }
  for (const f of Object.keys(FINDER_LABELS)) if (!seenB.has(f)) briefs.push({ finder: f, focus: `General ${FINDER_LABELS[f].toLowerCase()} help`, constraints: [] });
  await emit({ type: "found", agent: "orchestrator", count: needs.length,
    message: "Needs: " + needs.map((n) => `${n.category.replace("_", " ")} (${n.urgency.replace("_", " ")})`).join(", ") });
  return { needs, briefs };
}

// ------------------------------------------------------------------ 3. finder
function finderTools(ctx: Ctx, finder: string, p: any): Tool[] {
  const lat = p.lat ?? 0, lon = p.lon ?? 0;
  const tools: Tool[] = [{
    name: "search_snapshot",
    description: "Search TLM's California resource snapshot (CDCR parole resource guides, CareerOneStop reentry programs, HRSA health centers, " +
      "state essentials, TLM network programs, Second Chance grantees) for the person's county and neighbors.",
    input_schema: { type: "object", properties: {
      category: { type: "string", enum: CATEGORIES }, keywords: S("Space-separated keywords, e.g. 'sober living transitional women'") }, required: ["category"] },
    fn: (i: any) => ctx.snapshot.search(i.category, p.county, i.keywords || ""),
    label: (i: any) => `TLM resource snapshot: ${String(i.category || "").replace("_", " ")} ${i.keywords || ""}`.trim(),
  }];
  if (finder === "housing") tools.push({
    name: "hud_counselors", description: "HUD-approved housing counseling agencies near the person (live HUD API).",
    input_schema: { type: "object", properties: { miles: { type: "number" } } },
    fn: (i: any) => hudCounselors(lat, lon, i.miles || 10), label: (i: any) => `HUD housing counselors within ${i.miles || 10} mi of ${p.city}`,
  });
  if (finder === "health") tools.push({
    name: "find_treatment", description: "Substance use and mental health treatment facilities near the person (live FindTreatment.gov API).",
    input_schema: { type: "object", properties: { miles: { type: "number" }, keyword: S() } },
    fn: (i: any) => findTreatment(lat, lon, i.miles || 10, i.keyword || ""), label: (i: any) => `FindTreatment.gov within ${i.miles || 10} mi of ${p.city}`,
  });
  if (finder === "jobs" && ctx.env.CAREERONESTOP_TOKEN) tools.push({
    name: "careeronestop_ajc", description: "America's Job Centers near the person (live CareerOneStop API).",
    input_schema: { type: "object", properties: { radius: { type: "integer" } } },
    fn: (i: any) => careerOneStopAjc(ctx.env, p.zip || p.city, i.radius || 25), label: () => `CareerOneStop job centers near ${p.city}`,
  });
  if (finder === "legal_id") tools.push({
    name: "fdic_branches", description: "FDIC-insured bank branches in the person's city (live FDIC BankFind API).",
    input_schema: { type: "object", properties: {} },
    fn: () => fdicBranches(p.city), label: () => `FDIC bank branches in ${p.city}`,
  });
  return tools;
}

export async function find(ctx: Ctx, body: any) {
  const { emit } = ctx;
  const { profile, brief } = body;
  const finder = brief.finder as string;
  const label = FINDER_LABELS[finder];
  await emit({ type: "agent_start", agent: finder, message: `${label}: ${brief.focus || ""}` });
  const out = await runAgent({
    ...ctx, agent: finder, model: SONNET, effort: "medium",
    tools: finderTools(ctx, finder, profile), serverTools: webTools(profile.city, 6, 3),
    system: `You are the ${label} finder for The Last Mile's reentry team. Find real, current ${label.toLowerCase()} resources in California for one person.\n` +
      `${SHARED_RULES}\n` +
      "How to work: call search_snapshot and your live API tools first (call independent tools in parallel), then use web_search to fill gaps " +
      "(county 211 sites, county reentry pages, program websites) and web_fetch to confirm details like intake rules. " +
      "Submit 5-8 options. At least half must directly provide the service the brief asks for (a bed, a clinic, a meal, a job program, a legal clinic), " +
      "not only referral or counseling agencies. Cover every part of the brief. Then call submit.",
    user: `Brief: ${JSON.stringify(brief)}\n\nProfile:\n${profileText(profile)}`,
    submitSchema: { type: "object", properties: { candidates: { type: "array", items: CANDIDATE_ITEM, maxItems: 8 } }, required: ["candidates"] },
    submitDescription: "Submit 5-8 candidate programs found this run.",
  });
  const cands: any[] = [];
  let dropped = 0;
  for (const c of out.candidates || []) {
    if (!c || typeof c !== "object" || !c.name || !(c.source_url || c.url)) { dropped++; continue; }
    c.category = finder;
    c.source_url ||= c.url;
    c.source ||= "web";
    if (c.distance_miles != null && typeof c.distance_miles !== "number") c.distance_miles = parseFloat(String(c.distance_miles)) || undefined;
    c.tlm_network = !!c.tlm_network;
    cands.push(c);
  }
  if (dropped) await emit({ type: "error", agent: finder, message: `${label}: dropped ${dropped} result(s) with no traceable source` });
  await emit({ type: "found", agent: finder, message: `${label}: ${cands.length} programs shortlisted`, count: cands.length });
  return { candidates: cands };
}

// ------------------------------------------------------------------ 4. eligibility judge
export async function judge(ctx: Ctx, body: any) {
  const { emit } = ctx;
  const { profile, finder, candidates } = body;
  if (!candidates?.length) return { judged: [] };
  await emit({ type: "agent_start", agent: "eligibility", message: `Checking eligibility for ${candidates.length} ${FINDER_LABELS[finder].toLowerCase()} programs` });
  const ruleTool: Tool = {
    name: "lookup_rule",
    description: "Look up stored California eligibility rules (CalFresh, Medi-Cal, Cal-ID, General Relief, Prop 47, PC 1203.4, Clean Slate, HUD housing bars, Fair Chance Act).",
    input_schema: { type: "object", properties: { topic: S() }, required: ["topic"] },
    fn: (i: any) => ctx.snapshot.rule(i.topic || ""), label: (i: any) => `Rule lookup: ${i.topic || ""}`, countsAsSource: false,
  };
  const listing = candidates.map((c: any, index: number) => ({ index, ...c }));
  const out = await runAgent({
    ...ctx, agent: "eligibility", model: OPUS, effort: "low", tools: [ruleTool], serverTools: webTools(profile.city, 2, 1),
    system: "You are the eligibility judge for The Last Mile's reentry team. For each program, decide whether this FICTIONAL person qualifies, " +
      "reading the program's own listing first, then stored rules (lookup_rule), then official pages only when needed.\n" +
      `Gray-area policy: ${GRAY_AREA_POLICY}\n` +
      "Verdicts: likely (listing and profile clearly match), worth_applying (unclear, case-by-case, or a rule that may not apply; give one confirm_question), " +
      "not_eligible (a clear written exclusion definitely applies; cite it). Cite the rule or page you relied on. Be brief. Call submit with a verdict for every index.",
    user: `Profile:\n${profileText(profile)}\n\nPrograms:\n${JSON.stringify(listing, null, 1)}`,
    submitSchema: { type: "object", properties: { verdicts: { type: "array", items: { type: "object", properties: {
      index: { type: "integer" }, verdict: { type: "string", enum: ["likely", "worth_applying", "not_eligible"] },
      reason: S(), confirm_question: S(), rule_cited: S(), rule_url: S() }, required: ["index", "verdict", "reason"] } } }, required: ["verdicts"] },
    submitDescription: "Submit one verdict per program index.",
  });
  const byIdx = new Map<number, any>((out.verdicts || []).map((v: any) => [v.index, v]));
  const judged = candidates.map((c: any, i: number) => {
    let v = byIdx.get(i) || { verdict: "worth_applying", reason: "Not reviewed in time; confirm eligibility with the program.", confirm_question: "Do you serve people in my situation?" };
    if (v.verdict === "not_eligible" && !(v.rule_cited || v.rule_url)) {
      // Policy: no written rule cited -> keep it as worth applying.
      v = { ...v, verdict: "worth_applying", confirm_question: v.confirm_question || "Am I eligible given my situation?" };
    }
    return { ...c, verdict: v.verdict, reason: v.reason, confirm_question: v.confirm_question, rule_cited: v.rule_cited, rule_url: v.rule_url };
  });
  // A supervision county restriction is a written condition: in-person programs elsewhere are excluded.
  const restrict = String(profile.supervision?.county_restriction || "").replace(/ County$/i, "").trim().toLowerCase();
  for (const j of judged) {
    const county = String(j.county || "").replace(/ County$/i, "").trim().toLowerCase();
    if (restrict && county && !["statewide", "california", "online", restrict].includes(county) && j.verdict !== "not_eligible") {
      j.verdict = "not_eligible";
      j.reason = `In-person program in ${j.county} County; supervision conditions limit travel to ${profile.supervision.county_restriction} County.`;
      j.rule_cited = "Supervision county restriction (conditions of parole/probation)";
    }
  }
  const ok = judged.filter((j: any) => j.verdict !== "not_eligible").length;
  await emit({ type: "verdict", agent: "eligibility", count: judged.length,
    message: `${FINDER_LABELS[finder]}: ${ok} recommended, ${judged.length - ok} excluded` });
  return { judged };
}

// ------------------------------------------------------------------ 5. ranker
export async function rank(ctx: Ctx, body: any) {
  const { emit } = ctx;
  const { profile, needs, judged } = body;
  await emit({ type: "agent_start", agent: "ranker", message: "Ranking options and writing the plan for today" });
  const keep = (judged || []).filter((j: any) => j.verdict !== "not_eligible");
  const listing = keep.map((j: any, index: number) => ({
    index, category: j.category, name: j.name, description: j.description, verdict: j.verdict, confirm_question: j.confirm_question,
    intake_requirements: j.intake_requirements, distance_miles: j.distance_miles, city: j.city, cost: j.cost, tlm_network: j.tlm_network,
  }));
  const out = await runAgent({
    ...ctx, agent: "ranker", model: OPUS, effort: "medium",
    system: "You are the reentry planner for The Last Mile. Pick the best 2-3 programs per need for this FICTIONAL person, in the order of their needs, " +
      "and write an 'act on today' list of 1-3 concrete steps (most urgent first). Explain 'why it fits' in one plain sentence tied to their situation. " +
      "List what to bring (ID, release papers, proof of income, etc.). Prefer likely over worth_applying when equally good, but keep at least one " +
      "worth_applying option when it could matter. Use only the given indexes. " +
      // TLM demo: a second version of each step, written to the person, so the case manager can review it and share it
      "For each act_today step also write for_alumnus: the same step addressed to the person as 'you', in plain words a tired reader gets on first read, " +
      "without staff-only detail (no eligibility verdicts, no instructions meant for the case manager, no internal notes). Call submit.",
    user: `Profile:\n${profileText(profile)}\n\nNeeds in order:\n${JSON.stringify(needs)}\n\nPrograms:\n${JSON.stringify(listing, null, 1)}`,
    submitSchema: { type: "object", properties: {
      sections: { type: "array", items: { type: "object", properties: {
        category: S(), picks: { type: "array", items: { type: "object", properties: {
          index: { type: "integer" }, why_it_fits: S(), what_to_bring: { type: "array", items: S() } }, required: ["index", "why_it_fits"] } } },
        required: ["category", "picks"] } },
      act_today: { type: "array", maxItems: 3, items: { type: "object", properties: {
        step: S("For the case manager"), for_alumnus: S("The same step, written to the person as 'you'"), resource_index: { type: "integer" }, what_to_bring: { type: "array", items: S() } }, required: ["step", "for_alumnus"] } } },
      required: ["sections", "act_today"] },
    submitDescription: "Submit the ranked sections and today's steps.",
  });
  const needByCat = new Map<string, any>((needs || []).map((n: any) => [n.category, n]));
  const byCat = new Map<string, any>();
  const used = new Set<number>();
  for (const s of out.sections || []) {
    const cat = CATEGORIES.includes(s.category) ? s.category : "housing";
    if (!byCat.has(cat)) byCat.set(cat, { need: needByCat.get(cat) || { category: cat, urgency: "this_month", why: "" }, recommendations: [] });
    for (const pk of s.picks || []) {
      const i = pk.index;
      if (Number.isInteger(i) && i >= 0 && i < keep.length && !used.has(i)) {
        used.add(i);
        byCat.get(cat).recommendations.push({ candidate: keep[i], why_it_fits: pk.why_it_fits || "", what_to_bring: pk.what_to_bring || [] });
      }
    }
  }
  const order = new Map<string, number>((needs || []).map((n: any, k: number) => [n.category, k]));
  const sections = [...byCat.values()].filter((s) => s.recommendations.length)
    .sort((a, b) => (order.get(a.need.category) ?? 99) - (order.get(b.need.category) ?? 99));
  const act_today = (out.act_today || []).slice(0, 3).map((a: any) => ({
    step: a.step || "", for_alumnus: a.for_alumnus || "", what_to_bring: a.what_to_bring || [],
    resource_name: Number.isInteger(a.resource_index) && keep[a.resource_index] ? keep[a.resource_index].name : undefined,
  }));
  await emit({ type: "found", agent: "ranker", count: act_today.length,
    message: `Plan ready: ${sections.reduce((n, s) => n + s.recommendations.length, 0)} recommendations, ${act_today.length} steps for today` });
  return { sections, act_today };
}
