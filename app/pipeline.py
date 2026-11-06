"""Runtime agent assembly: intake -> orchestrator -> 5 finders (parallel) -> eligibility (parallel per need) -> ranker."""
from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any

from pydantic import ValidationError

from app.agents.base import OPUS, SONNET, Counters, Emit, Tool, run_agent, web_tools
from app.schemas import (
    ActStep, Candidate, JudgedCandidate, Need, NeedSection, OrchestratorPlan, Plan, Profile, Recommendation,
)
from app.tools import apis

FINDER_LABELS = {
    "housing": "Housing", "health": "Health & recovery", "food_benefits": "Food & benefits",
    "jobs": "Jobs & training", "legal_id": "Legal, ID & money",
}

SHARED_RULES = """Rules you always follow:
- The person is a FICTIONAL formerly incarcerated adult in California. Never ask for or invent personal details.
- Return only programs that appeared in a tool result or web page during THIS run, with the URL you found them at (source_url). Never write a program from memory.
- Stay in the person's county or a neighboring county unless the program is statewide, by phone, or online. If they are on parole/probation with a county restriction, stay inside that county.
- Respect supervision conditions: curfew hours, GPS charging needs, drug testing, no-contact rules.
- Prefer programs that serve people with records, are free or low cost, and are reachable without a car.
- Write in plain, respectful language (say "person returning home", not "offender")."""

GRAY_AREA_POLICY = (
    "When eligibility is uncertain, recommend the program as 'worth_applying' and state the one question to confirm. "
    "Only mark 'not_eligible' when a written rule clearly excludes this person. Missing information is never a reason to exclude."
)

CANDIDATE_ITEM = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "description": {"type": "string", "description": "What they offer, one or two sentences"},
        "address": {"type": "string"}, "city": {"type": "string"}, "county": {"type": "string"},
        "phone": {"type": "string"}, "url": {"type": "string"}, "hours": {"type": "string"},
        "who_it_serves": {"type": "string"}, "intake_requirements": {"type": "string"}, "cost": {"type": "string"},
        "source": {"type": "string", "description": "snapshot, findtreatment, hud, fdic, careeronestop, hrsa, 211, tlm, cdcr_dapo, state, county, or web"},
        "source_url": {"type": "string", "description": "Page or API where you found it this run"},
        "distance_miles": {"type": "number"},
        "tlm_network": {"type": "boolean"},
    },
    "required": ["name", "description", "source", "source_url"],
}


def _profile_text(p: Profile) -> str:
    return json.dumps(p.model_dump(exclude_none=True), indent=1)


# ------------------------------------------------------------------ 1. intake
async def intake(request: dict, emit: Emit, counters: Counters) -> Profile:
    await emit({"type": "agent_start", "agent": "intake", "message": "Reading the situation"})
    if request.get("profile"):
        raw = {k: v for k, v in request["profile"].items() if k in Profile.model_fields}
        profile = Profile.model_validate(raw)
    else:
        schema = Profile.model_json_schema()
        out = await run_agent(
            agent="intake", model=SONNET, effort="low", emit=emit, counters=counters,
            system="You turn a case manager's plain-language description of a FICTIONAL formerly incarcerated person in California into a structured profile. "
                   "Infer the California county from the city. Code offense categories only as: drug, violent, property, sex_registration, dui, other. "
                   "Leave fields you don't know unset; do not guess income or offense. Then call submit.",
            user=f"Situation:\n{request.get('text', '')}",
            submit_schema={"type": "object", "properties": {"profile": schema}, "required": ["profile"], "$defs": schema.get("$defs", {})},
            submit_description="Submit the structured profile.",
        )
        prof = out.get("profile", out)
        prof.setdefault("display_name", "Alumnus")
        profile = Profile.model_validate(prof)
    if profile.lat is None:
        g = await apis.geocode(profile.zip or profile.city)
        await emit({"type": "tool_call", "agent": "intake", "tool": "geocode", "message": f"Located {profile.city} ({profile.county} County)"})
        if "lat" in g:
            profile.lat, profile.lon = g["lat"], g["lon"]
            profile.zip = profile.zip or g.get("zip")
    await emit({"type": "found", "agent": "intake", "message": f"Profile ready: {profile.city}, {profile.county} County", "count": 1})
    return profile


# ------------------------------------------------------------------ 2. orchestrator
async def orchestrate(profile: Profile, emit: Emit, counters: Counters) -> OrchestratorPlan:
    await emit({"type": "agent_start", "agent": "orchestrator", "message": "Ordering needs and briefing the finders"})
    out = await run_agent(
        agent="orchestrator", model=OPUS, effort="low", emit=emit, counters=counters,
        system="You are the lead reentry navigator for The Last Mile. Given a FICTIONAL alumnus profile in California, decide what they need most, "
               "in order of urgency (safety, a place to sleep tonight, ID and documents, food and income, health coverage, supervision compliance, then work, legal and family). "
               "Then write a short, specific brief for each of the five finder agents (housing, health, food_benefits, jobs, legal_id). "
               "Every finder must get a brief, even for lower-priority needs; legal_id also covers state ID, record relief and bank accounts. "
               "Constraints must carry supervision limits (county restriction, curfew, GPS) and practical limits (no car, no ID). Call submit.",
        user=f"Profile:\n{_profile_text(profile)}",
        submit_schema={
            "type": "object",
            "properties": {
                "needs": {"type": "array", "items": {"type": "object", "properties": {
                    "category": {"type": "string", "enum": ["housing", "health", "food_benefits", "jobs", "legal_id", "family", "clothing"]},
                    "urgency": {"type": "string", "enum": ["today", "this_week", "this_month"]},
                    "why": {"type": "string"}}, "required": ["category", "urgency", "why"]}},
                "briefs": {"type": "array", "items": {"type": "object", "properties": {
                    "finder": {"type": "string", "enum": ["housing", "health", "food_benefits", "jobs", "legal_id"]},
                    "focus": {"type": "string"},
                    "constraints": {"type": "array", "items": {"type": "string"}}}, "required": ["finder", "focus"]}},
            },
            "required": ["needs", "briefs"],
        },
        submit_description="Submit the ordered needs and one brief per finder.",
    )
    plan = OrchestratorPlan.model_validate(out)
    seen_needs, needs = set(), []
    for n in plan.needs:  # one need per category, first (most urgent) wins
        if n.category not in seen_needs:
            seen_needs.add(n.category)
            needs.append(n)
    plan.needs = needs
    seen_b, briefs = set(), []
    for b in plan.briefs:
        if b.finder not in seen_b:
            seen_b.add(b.finder)
            briefs.append(b)
    plan.briefs = briefs
    have = {b.finder for b in plan.briefs}
    for f in FINDER_LABELS:
        if f not in have:
            plan.briefs.append({"finder": f, "focus": f"General {FINDER_LABELS[f].lower()} help", "constraints": []})  # type: ignore[arg-type]
    plan = OrchestratorPlan.model_validate(plan.model_dump())
    await emit({"type": "found", "agent": "orchestrator",
                "message": "Needs: " + ", ".join(f"{n.category.replace('_', ' ')} ({n.urgency.replace('_', ' ')})" for n in plan.needs),
                "count": len(plan.needs)})
    return plan


# ------------------------------------------------------------------ 3. finders
def _finder_tools(finder: str, p: Profile) -> list[Tool]:
    def snap(category: str, keywords: str = ""):
        return apis.search_snapshot(category, p.county, keywords)

    snapshot_tool = Tool(
        "search_snapshot",
        "Search TLM's California resource snapshot (CDCR parole resource guides, CareerOneStop reentry programs, HRSA health centers, "
        "state essentials, TLM network programs, Second Chance grantees) for the person's county and neighbors.",
        {"type": "object", "properties": {
            "category": {"type": "string", "enum": ["housing", "health", "food_benefits", "jobs", "legal_id", "family", "clothing"]},
            "keywords": {"type": "string", "description": "Space-separated keywords, e.g. 'sober living transitional women'"}},
            "required": ["category"]},
        snap, label=lambda i: f"TLM resource snapshot: {i.get('category', '').replace('_', ' ')} {i.get('keywords', '')}".strip(),
    )
    tools = [snapshot_tool]
    lat, lon = p.lat or 0.0, p.lon or 0.0
    if finder == "housing":
        tools.append(Tool("hud_counselors", "HUD-approved housing counseling agencies near the person (live HUD API).",
                          {"type": "object", "properties": {"miles": {"type": "number"}}},
                          lambda miles=10: apis.hud_counselors(lat, lon, miles),
                          label=lambda i: f"HUD housing counselors within {i.get('miles', 10)} mi of {p.city}"))
    if finder == "health":
        tools.append(Tool("find_treatment", "Substance use and mental health treatment facilities near the person (live FindTreatment.gov API).",
                          {"type": "object", "properties": {"miles": {"type": "number"}, "keyword": {"type": "string"}}},
                          lambda miles=10, keyword="": apis.find_treatment(lat, lon, miles, keyword),
                          label=lambda i: f"FindTreatment.gov within {i.get('miles', 10)} mi of {p.city}"))
    if finder == "jobs" and os.getenv("CAREERONESTOP_TOKEN"):
        tools.append(Tool("careeronestop_ajc", "America's Job Centers near the person (live CareerOneStop API).",
                          {"type": "object", "properties": {"radius": {"type": "integer"}}},
                          lambda radius=25: apis.careeronestop_ajc(p.zip or p.city, radius),
                          label=lambda i: f"CareerOneStop job centers near {p.city}"))
    if finder == "legal_id":
        tools.append(Tool("fdic_branches", "FDIC-insured bank branches in the person's city (live FDIC BankFind API).",
                          {"type": "object", "properties": {}},
                          lambda: apis.fdic_branches(p.city, ""),
                          label=lambda i: f"FDIC bank branches in {p.city}"))
    if os.getenv("TWO11_API_KEY"):
      tools.append(Tool("search_211", "Search 211 community resources near the person (live 211 API, if configured).",
                      {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
                      lambda query: apis.search_211(query, lat, lon),
                      label=lambda i: f"211 search: {i.get('query', '')}"))
    return tools


async def find(finder: str, brief: dict, profile: Profile, emit: Emit, counters: Counters) -> list[Candidate]:
    label = FINDER_LABELS[finder]
    await emit({"type": "agent_start", "agent": finder, "message": f"{label}: {brief.get('focus', '')}"})
    out = await run_agent(
        agent=finder, model=SONNET, effort="medium", emit=emit, counters=counters,
        tools=_finder_tools(finder, profile), server_tools=web_tools(profile.city, search_uses=6, fetch_uses=3),
        system=f"You are the {label} finder for The Last Mile's reentry team. Find real, current {label.lower()} resources in California for one person.\n"
               f"{SHARED_RULES}\n"
               "How to work: call search_snapshot and your live API tools first (call independent tools in parallel), then use web_search to fill gaps "
               "(county 211 sites, county reentry pages, program websites) and web_fetch to confirm details like intake rules. "
               "Submit 5-8 options. At least half must directly provide the service the brief asks for (a bed, a clinic, a meal, a job program, a legal clinic), "
               "not only referral or counseling agencies. Cover every part of the brief. Then call submit.",
        user=f"Brief: {json.dumps(brief)}\n\nProfile:\n{_profile_text(profile)}",
        submit_schema={"type": "object", "properties": {"candidates": {"type": "array", "items": CANDIDATE_ITEM, "maxItems": 8}}, "required": ["candidates"]},
        submit_description="Submit 5-8 candidate programs found this run.",
    )
    cands = []
    dropped = 0
    for c in out.get("candidates", []):
        if not isinstance(c, dict):
            dropped += 1
            continue
        c["category"] = finder
        if not (c.get("source_url") or c.get("url")):
            dropped += 1
            continue  # never keep a program we can't trace to a source
        c["source_url"] = c.get("source_url") or c.get("url")
        cand = _lenient_candidate(c)
        if cand:
            cands.append(cand)
        else:
            dropped += 1
    if dropped:
        await emit({"type": "error", "agent": finder, "message": f"{label}: dropped {dropped} result(s) with no traceable source"})
    await emit({"type": "found", "agent": finder, "message": f"{label}: {len(cands)} programs shortlisted", "count": len(cands)})
    return cands


# ------------------------------------------------------------------ 4. eligibility judge
async def judge(finder: str, cands: list[Candidate], profile: Profile, emit: Emit, counters: Counters) -> list[JudgedCandidate]:
    if not cands:
        return []
    await emit({"type": "agent_start", "agent": "eligibility", "message": f"Checking eligibility for {len(cands)} {FINDER_LABELS[finder].lower()} programs"})
    rule_tool = Tool("lookup_rule", "Look up stored California eligibility rules (CalFresh, Medi-Cal, Cal-ID, General Relief, Prop 47, PC 1203.4, Clean Slate, HUD housing bars, Fair Chance Act).",
                     {"type": "object", "properties": {"topic": {"type": "string"}}, "required": ["topic"]},
                     apis.lookup_rule, label=lambda i: f"Rule lookup: {i.get('topic', '')}", counts_as_source=False)
    listing = [{"index": i, **c.model_dump(exclude_none=True)} for i, c in enumerate(cands)]
    out = await run_agent(
        agent="eligibility", model=OPUS, effort="low", emit=emit, counters=counters,
        tools=[rule_tool], server_tools=web_tools(profile.city, search_uses=2, fetch_uses=1),
        system="You are the eligibility judge for The Last Mile's reentry team. For each program, decide whether this FICTIONAL person qualifies, "
               "reading the program's own listing first, then stored rules (lookup_rule), then official pages only when needed.\n"
               f"Gray-area policy: {GRAY_AREA_POLICY}\n"
               "Verdicts: likely (listing and profile clearly match), worth_applying (unclear, case-by-case, or a rule that may not apply; give one confirm_question), "
               "not_eligible (a clear written exclusion definitely applies; cite it). Cite the rule or page you relied on. Be brief. Call submit with a verdict for every index.",
        user=f"Profile:\n{_profile_text(profile)}\n\nPrograms:\n{json.dumps(listing, indent=1)}",
        submit_schema={"type": "object", "properties": {"verdicts": {"type": "array", "items": {"type": "object", "properties": {
            "index": {"type": "integer"},
            "verdict": {"type": "string", "enum": ["likely", "worth_applying", "not_eligible"]},
            "reason": {"type": "string"}, "confirm_question": {"type": "string"},
            "rule_cited": {"type": "string"}, "rule_url": {"type": "string"}},
            "required": ["index", "verdict", "reason"]}}}, "required": ["verdicts"]},
        submit_description="Submit one verdict per program index.",
    )
    by_idx = {v.get("index"): v for v in out.get("verdicts", []) if isinstance(v, dict)}
    judged = []
    for i, c in enumerate(cands):
        v = by_idx.get(i) or {"verdict": "worth_applying", "reason": "Not reviewed in time; confirm eligibility with the program.",
                               "confirm_question": "Do you serve people in my situation?"}
        if v.get("verdict") == "not_eligible" and not (v.get("rule_cited") or v.get("rule_url")):
            # Policy: no written rule cited -> keep it as worth applying.
            v = {**v, "verdict": "worth_applying", "confirm_question": v.get("confirm_question") or "Am I eligible given my situation?"}
        judged.append(JudgedCandidate.model_validate({**c.model_dump(), **{k: v.get(k) for k in
                      ("verdict", "reason", "confirm_question", "rule_cited", "rule_url")}}))
    judged = [_enforce_county(j, profile) for j in judged]
    n_ok = sum(j.verdict != "not_eligible" for j in judged)
    await emit({"type": "verdict", "agent": "eligibility",
                "message": f"{FINDER_LABELS[finder]}: {n_ok} recommended, {len(judged) - n_ok} excluded", "count": len(judged)})
    return judged


# ------------------------------------------------------------------ 5. ranker
async def rank(profile: Profile, orch: OrchestratorPlan, judged: list[JudgedCandidate], emit: Emit, counters: Counters):
    await emit({"type": "agent_start", "agent": "ranker", "message": "Ranking options and writing the plan for today"})
    keep = [j for j in judged if j.verdict != "not_eligible"]
    listing = [{"index": i, "category": j.category, "name": j.name, "description": j.description, "verdict": j.verdict,
                "confirm_question": j.confirm_question, "intake_requirements": j.intake_requirements, "distance_miles": j.distance_miles,
                "city": j.city, "cost": j.cost, "tlm_network": j.tlm_network} for i, j in enumerate(keep)]
    out = await run_agent(
        agent="ranker", model=OPUS, effort="medium", emit=emit, counters=counters,
        system="You are the reentry planner for The Last Mile. Pick the best 2-3 programs per need for this FICTIONAL person, in the order of their needs, "
               "and write an 'act on today' list of 1-3 concrete steps (most urgent first). Explain 'why it fits' in one plain sentence tied to their situation. "
               "List what to bring (ID, release papers, proof of income, etc.). Prefer likely over worth_applying when equally good, but keep at least one "
               "worth_applying option when it could matter. Use only the given indexes. "
               "For each act_today step also write for_alumnus: the same step addressed to the person as 'you', in plain words a tired reader gets on first read, "
               "without staff-only detail (no eligibility verdicts, no instructions meant for the case manager, no internal notes). Call submit.",
        user=f"Profile:\n{_profile_text(profile)}\n\nNeeds in order:\n{json.dumps([n.model_dump() for n in orch.needs])}\n\nPrograms:\n{json.dumps(listing, indent=1)}",
        submit_schema={"type": "object", "properties": {
            "sections": {"type": "array", "items": {"type": "object", "properties": {
                "category": {"type": "string"},
                "picks": {"type": "array", "items": {"type": "object", "properties": {
                    "index": {"type": "integer"}, "why_it_fits": {"type": "string"},
                    "what_to_bring": {"type": "array", "items": {"type": "string"}}}, "required": ["index", "why_it_fits"]}}},
                "required": ["category", "picks"]}},
            "act_today": {"type": "array", "items": {"type": "object", "properties": {
                "step": {"type": "string", "description": "For the case manager"},
                "for_alumnus": {"type": "string", "description": "The same step, written to the person as 'you'"},
                "resource_index": {"type": "integer"},
                "what_to_bring": {"type": "array", "items": {"type": "string"}}}, "required": ["step", "for_alumnus"]}, "maxItems": 3}},
            "required": ["sections", "act_today"]},
        submit_description="Submit the ranked sections and today's steps.",
    )
    needs_by_cat = {n.category: n for n in orch.needs}
    by_cat: dict[str, NeedSection] = {}
    used: set[int] = set()
    for s in out.get("sections", []):
        cat = _cat(s.get("category"))
        need = needs_by_cat.get(cat) or Need(category=cat, urgency="this_month", why="")
        sec = by_cat.setdefault(cat, NeedSection(need=need, recommendations=[]))
        for pk in s.get("picks", []):
            i = pk.get("index")
            if isinstance(i, int) and 0 <= i < len(keep) and i not in used:
                used.add(i)
                sec.recommendations.append(Recommendation(candidate=keep[i], why_it_fits=pk.get("why_it_fits", ""), what_to_bring=pk.get("what_to_bring") or []))
    sections = [s for s in by_cat.values() if s.recommendations]
    order = {n.category: k for k, n in enumerate(orch.needs)}
    sections.sort(key=lambda s: order.get(s.need.category, 99))
    act = []
    for a in out.get("act_today", [])[:3]:
        i = a.get("resource_index")
        name = keep[i].name if isinstance(i, int) and 0 <= i < len(keep) else None
        act.append(ActStep(step=a.get("step", ""), for_alumnus=a.get("for_alumnus", ""), resource_name=name, what_to_bring=a.get("what_to_bring") or []))
    await emit({"type": "found", "agent": "ranker", "message": f"Plan ready: {sum(len(s.recommendations) for s in sections)} recommendations, {len(act)} steps for today", "count": len(act)})
    return sections, act


def _enforce_county(j: JudgedCandidate, profile: Profile) -> JudgedCandidate:
    """A supervision county restriction is a written condition: in-person programs elsewhere are excluded."""
    restrict = (profile.supervision.county_restriction or "").replace(" County", "").strip().lower()
    county = (j.county or "").replace(" County", "").strip().lower()
    if restrict and county and county not in (restrict, "statewide", "california", "online") and j.verdict != "not_eligible":
        return j.model_copy(update={"verdict": "not_eligible",
            "reason": f"In-person program in {j.county} County; supervision conditions limit travel to {profile.supervision.county_restriction} County.",
            "rule_cited": "Supervision county restriction (conditions of parole/probation)"})
    return j


def _lenient_candidate(c: dict):
    """Validate a candidate; drop bad optional fields instead of the whole program."""
    try:
        return Candidate.model_validate(c)
    except ValidationError as e:
        bad = {err["loc"][0] for err in e.errors() if err.get("loc")}
        fixed = {k: v for k, v in c.items() if k not in bad or k in ("name", "category", "source")}
        if "distance_miles" in bad:
            try:
                fixed["distance_miles"] = float(str(c["distance_miles"]).split()[0])
            except (ValueError, IndexError):
                pass
        for k in list(fixed):
            if k in Candidate.model_fields and k not in ("distance_miles", "tlm_network") and fixed[k] is not None and not isinstance(fixed[k], str):
                fixed[k] = str(fixed[k])
        try:
            return Candidate.model_validate(fixed)
        except ValidationError:
            return None


def _cat(c: Any) -> str:
    return c if c in ("housing", "health", "food_benefits", "jobs", "legal_id", "family", "clothing") else "housing"


# ------------------------------------------------------------------ entry point
async def run_pipeline(request: dict, emit: Emit) -> Plan:
    t0 = time.time()
    counters = Counters()
    profile = await intake(request, emit, counters)
    orch = await orchestrate(profile, emit, counters)

    async def safe_judge(finder, cands):
        try:
            return await judge(finder, cands, profile, emit, counters)
        except Exception as e:  # noqa: BLE001
            await emit({"type": "error", "agent": "eligibility", "message": f"Eligibility check failed for {finder}: {e}; kept as worth applying"})
            return [JudgedCandidate.model_validate({**c.model_dump(), "verdict": "worth_applying",
                    "reason": "Eligibility not checked; confirm with the program.", "confirm_question": "Am I eligible?"}) for c in cands]

    async def find_then_judge(b):
        # Each category goes to the eligibility judge as soon as its finder is done.
        try:
            cands = await find(b.finder, b.model_dump(), profile, emit, counters)
        except Exception as e:  # noqa: BLE001
            await emit({"type": "error", "agent": b.finder, "message": f"{FINDER_LABELS[b.finder]} finder stopped: {e}"})
            return []
        return await safe_judge(b.finder, cands)

    judged_lists = await asyncio.gather(*[find_then_judge(b) for b in orch.briefs])
    judged = [j for lst in judged_lists for j in lst]
    sections, act = await rank(profile, orch, judged, emit, counters)
    secs = round(time.time() - t0, 1)
    plan = Plan(
        profile=profile, sections=sections, act_today=act,
        excluded=[j for j in judged if j.verdict == "not_eligible"],
        stats={"programs_checked": counters.programs_checked, "sources_searched": counters.sources_searched,
               "est_minutes_saved": counters.sources_searched * 3, "seconds": secs,
               "candidates_judged": len(judged)},
    )
    await emit({"type": "done", "plan": plan.model_dump(mode="json")})
    return plan
