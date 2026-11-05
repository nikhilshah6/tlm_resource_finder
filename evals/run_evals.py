"""Eval harness for the reentry resource pipeline.

Usage (from the repo root):
    .venv/bin/python evals/run_evals.py                      # all 18 profiles, real pipeline, LLM grader
    .venv/bin/python evals/run_evals.py --fake --no-llm      # harness self-test, no API key needed
    .venv/bin/python evals/run_evals.py --ids marcus-oakland,anthony-sf --concurrency 2
    .venv/bin/python evals/run_evals.py --presets --no-links # only the 4 demo presets, skip link checks

Writes evals/runs/<timestamp>/<id>.json (plan), <id>.events.json, summary.json, report.md,
and evals/report.md (latest), and prints the report.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

EVALS_DIR = Path(__file__).resolve().parent
ROOT = EVALS_DIR.parent
sys.path.insert(0, str(ROOT))

try:  # optional .env support for ANTHROPIC_API_KEY
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except Exception:  # pragma: no cover
    pass

import httpx  # noqa: E402

from app.schemas import Plan, Profile  # noqa: E402

GRADER_MODEL = "claude-opus-5-5"
EXTRA_PROFILE_KEYS = ("preset", "label", "summary")
TARGETS = {
    "recall": 0.85,
    "gray_kept": 1.0,
    "wrong_exclusions": 0,
    "must_not": 0,
    "invented": 0,
    "links": 0.90,
    "seconds": 90.0,
}
STATEWIDE_HINTS = ("statewide", "online", "virtual", "by phone", "hotline", "nationwide", "california")
REGISTRANT_EXCLUDE_RE = re.compile(
    r"(no|not|excludes?|bars?|cannot|can't|ineligible)\b[^.]{0,40}\b(sex offender|registrant|290|megan'?s law)"
    r"|(sex offender|registrant|290)s?\b[^.]{0,30}\b(not (eligible|accepted|allowed)|excluded|ineligible|barred)",
    re.I,
)


# ---------------------------------------------------------------- loading


def load_profiles() -> list[dict]:
    return json.loads((EVALS_DIR / "profiles.json").read_text())


def load_expected() -> dict[str, dict]:
    return json.loads((EVALS_DIR / "expected.json").read_text())


def clean_profile(p: dict) -> dict:
    d = {k: v for k, v in p.items() if k not in EXTRA_PROFILE_KEYS}
    return Profile.model_validate(d).model_dump()


# ---------------------------------------------------------------- running


def get_pipeline(fake: bool):
    if fake:
        from evals.fake_pipeline import run_pipeline
    else:
        from app.pipeline import run_pipeline
    return run_pipeline


async def run_one(run_pipeline, profile: dict, out_dir: Path, timeout: float) -> dict:
    pid = profile["id"]
    events: list[dict] = []

    async def emit(event: dict) -> None:
        events.append(event)

    t0 = time.perf_counter()
    plan_dict = None
    error = None
    try:
        plan = await asyncio.wait_for(run_pipeline({"profile": clean_profile(profile)}, emit), timeout)
        plan_dict = plan.model_dump() if hasattr(plan, "model_dump") else Plan.model_validate(plan).model_dump()
    except Exception as e:  # keep evaluating other profiles
        error = f"{type(e).__name__}: {e}"
    seconds = time.perf_counter() - t0

    if plan_dict is not None:
        (out_dir / f"{pid}.json").write_text(json.dumps(plan_dict, indent=2, default=str))
    (out_dir / f"{pid}.events.json").write_text(json.dumps(events, indent=2, default=str))
    status = "ok" if error is None else f"ERROR {error}"
    print(f"  [{pid}] {status} in {seconds:.1f}s", flush=True)
    return {"id": pid, "plan": plan_dict, "events": events, "seconds": seconds, "error": error}


# ---------------------------------------------------------------- deterministic scoring


def recommended(plan: dict) -> list[dict]:
    return [r["candidate"] for s in plan.get("sections", []) for r in s.get("recommendations", [])]


def all_judged(plan: dict) -> list[dict]:
    return recommended(plan) + list(plan.get("excluded", []))


def _txt(c: dict, *fields: str) -> str:
    return " ".join(str(c.get(f) or "") for f in fields).lower()


def name_desc(c: dict) -> str:
    return _txt(c, "name", "description")


def score_includes(plan: dict, exp: dict) -> dict:
    recs = recommended(plan)
    cats = {c.get("category") for c in recs} | {
        s["need"]["category"] for s in plan.get("sections", []) if s.get("recommendations")
    }
    need_cats = exp.get("must_include_categories", [])
    missing_cats = [c for c in need_cats if c not in cats]
    hay = [name_desc(c) for c in recs]
    groups = exp.get("must_include_any", [])
    missing_groups = [g for g in groups if not any(k.lower() in h for k in g for h in hay)]
    return {
        "cat_hit": len(need_cats) - len(missing_cats),
        "cat_total": len(need_cats),
        "any_hit": len(groups) - len(missing_groups),
        "any_total": len(groups),
        "missing_categories": missing_cats,
        "missing_groups": missing_groups,
    }


def score_gray(plan: dict, exp: dict) -> dict:
    pool = all_judged(plan)
    kept, details = 0, []
    for g in exp.get("gray_areas", []):
        kws = [g["program_keyword"], *g.get("aliases", [])]
        kws = [k.lower() for k in kws]
        matches = [c for c in pool if any(k in (c.get("name") or "").lower() for k in kws)]
        if not matches:  # fall back to descriptions
            matches = [c for c in pool if any(k in name_desc(c) for k in kws)]
        ok = [c for c in matches if c.get("verdict") != "not_eligible"]
        if ok:
            kept += 1
            details.append({"keyword": g["program_keyword"], "status": "kept", "verdict": ok[0].get("verdict"), "name": ok[0].get("name")})
        elif matches:
            details.append({"keyword": g["program_keyword"], "status": "EXCLUDED", "name": matches[0].get("name"), "reason": matches[0].get("reason")})
        else:
            details.append({"keyword": g["program_keyword"], "status": "missing"})
    return {"gray_kept": kept, "gray_total": len(exp.get("gray_areas", [])), "gray_details": details}


def _norm_county(s: str | None) -> str:
    return re.sub(r"\s+county$", "", (s or "").strip().lower())


def score_must_not_deterministic(plan: dict, exp: dict) -> list[dict]:
    viols = []
    recs = recommended(plan)
    for i, rule in enumerate(exp.get("must_not", [])):
        if "keyword" in rule:
            kw = rule["keyword"].lower()
            for c in recs:
                if kw in _txt(c, "name", "who_it_serves", "intake_requirements"):
                    viols.append({"rule_index": i, "rule": rule["keyword"], "candidate": c.get("name"), "by": "keyword"})
        check = rule.get("check")
        if check == "county_restriction":
            want = _norm_county(rule.get("county"))
            for c in recs:
                cc = _norm_county(c.get("county"))
                if cc and cc != want and not any(h in name_desc(c) for h in STATEWIDE_HINTS):
                    viols.append({"rule_index": i, "rule": rule["rule"], "candidate": c.get("name"), "by": "county check", "county": c.get("county")})
        elif check == "text_excludes_registrants":
            for c in recs:
                t = _txt(c, "who_it_serves", "intake_requirements", "description", "reason")
                if REGISTRANT_EXCLUDE_RE.search(t):
                    viols.append({"rule_index": i, "rule": rule["rule"], "candidate": c.get("name"), "by": "registrant text"})
    return viols


UNCERTAIN_RE = re.compile(r"\b(unclear|unknown|not (provided|stated|specified|sure)|missing|may not|might not|probably|likely not|info)\b", re.I)


def heuristic_wrong_exclusions(plan: dict) -> list[dict]:
    """Without the LLM: an exclusion is 'wrong' if it cites no rule or its reason sounds uncertain."""
    out = []
    for i, c in enumerate(plan.get("excluded", [])):
        reason = c.get("reason") or ""
        if not (c.get("rule_cited") or "").strip() or UNCERTAIN_RE.search(reason):
            out.append({"index": i, "name": c.get("name"), "why": "no rule_cited or uncertain reason (heuristic)", "reason": reason})
    return out


def score_invented(plan: dict, events: list[dict]) -> dict:
    recs = recommended(plan)
    missing = [c.get("name") for c in recs if not (c.get("source_url") or "").strip()]
    tool_text = " ".join(str(e.get("message") or "") for e in events if e.get("type") == "tool_call")
    web_unverified = [
        c.get("name")
        for c in recs
        if (c.get("source") or "").lower() == "web" and c.get("source_url") and c["source_url"] not in tool_text
    ]
    return {"invented": len(missing), "invented_names": missing, "web_unverified": len(web_unverified), "web_unverified_names": web_unverified}


def rec_urls(plan: dict) -> list[str]:
    urls = []
    for c in recommended(plan):
        u = (c.get("url") or c.get("source_url") or "").strip()
        if u.startswith("http") and u not in urls:
            urls.append(u)
    return urls


# ---------------------------------------------------------------- link checks


class LinkChecker:
    def __init__(self, concurrency: int = 10):
        self.cache: dict[str, int | str] = {}
        self.sem = asyncio.Semaphore(concurrency)
        self.client = httpx.AsyncClient(
            timeout=8.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (reentry-agents eval link checker)"},
        )

    async def status(self, url: str) -> int | str:
        if url in self.cache:
            return self.cache[url]
        async with self.sem:
            result: int | str
            try:
                r = await self.client.head(url)
                result = r.status_code
                if result >= 400:  # many sites reject HEAD
                    r = await self.client.get(url)
                    result = r.status_code
            except Exception as e:
                try:
                    r = await self.client.get(url)
                    result = r.status_code
                except Exception:
                    result = type(e).__name__
        self.cache[url] = result
        return result

    async def check(self, urls: list[str]) -> dict:
        statuses = await asyncio.gather(*(self.status(u) for u in urls))
        bad = [{"url": u, "status": s} for u, s in zip(urls, statuses) if not (isinstance(s, int) and s < 400)]
        return {"links_ok": len(urls) - len(bad), "links_total": len(urls), "bad_links": bad}

    async def close(self):
        await self.client.aclose()


# ---------------------------------------------------------------- LLM grader

GRADER_SYSTEM = """You grade the output of a reentry-resource assistant for formerly incarcerated people in California.
Policy: a program may be marked not_eligible ONLY when a clear written rule (statute, regulation, or the program's own published eligibility rule) excludes this person. Missing or unknown information is NEVER a valid reason to exclude; uncertainty must produce worth_applying with a confirm question. Common myths are not rules (e.g. California does NOT bar people with drug felonies from CalFresh).

Task A (exclusions): for each excluded program, decide wrong_exclusion=true if its reason does not cite a clear written rule that actually applies to this person given the profile, or relies on missing info, guesses, or myths.
Task B (must_not): for each must_not rule (indexed), list any RECOMMENDED program that violates it. Only report clear violations.
Return JSON only."""

GRADER_SCHEMA = {
    "type": "object",
    "properties": {
        "exclusions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "wrong_exclusion": {"type": "boolean"},
                    "why": {"type": "string"},
                },
                "required": ["index", "wrong_exclusion", "why"],
                "additionalProperties": False,
            },
        },
        "must_not_violations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "rule_index": {"type": "integer"},
                    "candidate_name": {"type": "string"},
                    "why": {"type": "string"},
                },
                "required": ["rule_index", "candidate_name", "why"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["exclusions", "must_not_violations"],
    "additionalProperties": False,
}


class Grader:
    def __init__(self, enabled: bool):
        self.enabled = enabled
        self.client = None
        self.note = ""
        if not enabled:
            self.note = "LLM grader disabled (--no-llm); heuristic used for wrong exclusions."
            return
        if not os.environ.get("ANTHROPIC_API_KEY"):
            self.enabled = False
            self.note = "LLM grader skipped: ANTHROPIC_API_KEY not set; heuristic used for wrong exclusions."
            return
        try:
            import anthropic

            self.anthropic = anthropic
            self.client = anthropic.AsyncAnthropic()
            self.note = f"LLM grader: {GRADER_MODEL}."
        except Exception as e:
            self.enabled = False
            self.note = f"LLM grader unavailable ({type(e).__name__}: {e}); heuristic used."

    def _payload(self, profile: dict, plan: dict, exp: dict) -> str:
        keep = ("name", "category", "description", "county", "who_it_serves", "intake_requirements", "verdict", "reason", "rule_cited", "rule_url")
        excl = [{"index": i, **{k: c.get(k) for k in keep}} for i, c in enumerate(plan.get("excluded", []))]
        recs = [{k: c.get(k) for k in keep} for c in recommended(plan)]
        rules = [{"rule_index": i, **r} for i, r in enumerate(exp.get("must_not", []))]
        return json.dumps({"profile": clean_profile(profile), "excluded": excl, "recommended": recs, "must_not_rules": rules}, indent=1)

    @staticmethod
    def _parse(resp) -> dict:
        text = "".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", "") == "text")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", text, re.S)
            if not m:
                raise
            return json.loads(m.group(0))

    async def grade(self, profile: dict, plan: dict, exp: dict) -> dict | None:
        if not self.enabled:
            return None
        if not plan.get("excluded") and not exp.get("must_not"):
            return {"exclusions": [], "must_not_violations": []}
        msg = [{"role": "user", "content": self._payload(profile, plan, exp)}]
        base = dict(
            model=GRADER_MODEL,
            max_tokens=16000,
            system=GRADER_SYSTEM,
            messages=msg,
            thinking={"type": "adaptive"},
        )
        try:
            try:
                resp = await self.client.messages.create(
                    **base, output_config={"effort": "medium", "format": {"type": "json_schema", "schema": GRADER_SCHEMA}}
                )
            except self.anthropic.BadRequestError:
                # Fall back to plain JSON instructions if structured output is rejected.
                base["messages"] = [{"role": "user", "content": msg[0]["content"] + "\n\nRespond with JSON matching: " + json.dumps(GRADER_SCHEMA)}]
                resp = await self.client.messages.create(**base, output_config={"effort": "medium"})
            return self._parse(resp)
        except Exception as e:
            print(f"  [grader] {profile.get('id')}: {type(e).__name__}: {e}", flush=True)
            return {"error": f"{type(e).__name__}: {e}"}


# ---------------------------------------------------------------- per-profile scoring


async def score(result: dict, profile: dict, exp: dict, grader: Grader, links: LinkChecker | None) -> dict:
    row: dict[str, Any] = {"id": result["id"], "seconds": round(result["seconds"], 1), "error": result["error"]}
    plan = result["plan"]
    if plan is None:
        row.update(
            cat_hit=0, cat_total=len(exp.get("must_include_categories", [])),
            any_hit=0, any_total=len(exp.get("must_include_any", [])),
            gray_kept=0, gray_total=len(exp.get("gray_areas", [])),
            wrong_exclusions=0, must_not=0, invented=0, links_ok=0, links_total=0,
            n_recommended=0, n_excluded=0,
        )
        return row

    row.update(score_includes(plan, exp))
    row.update(score_gray(plan, exp))
    row.update(score_invented(plan, result["events"]))
    row["n_recommended"] = len(recommended(plan))
    row["n_excluded"] = len(plan.get("excluded", []))

    mn = score_must_not_deterministic(plan, exp)
    graded = await grader.grade(profile, plan, exp)
    if graded and "error" not in graded:
        excl = plan.get("excluded", [])
        wrong = [
            {"index": g["index"], "name": excl[g["index"]].get("name") if 0 <= g["index"] < len(excl) else None, "why": g["why"]}
            for g in graded.get("exclusions", [])
            if g.get("wrong_exclusion")
        ]
        row["grader"] = "llm"
        seen = {(v["rule_index"], (v["candidate"] or "").lower()) for v in mn}
        for v in graded.get("must_not_violations", []):
            key = (v["rule_index"], v["candidate_name"].lower())
            if key not in seen:
                seen.add(key)
                mn.append({"rule_index": v["rule_index"], "candidate": v["candidate_name"], "by": "llm", "why": v["why"]})
    else:
        wrong = heuristic_wrong_exclusions(plan)
        row["grader"] = "heuristic" + (f" ({graded['error']})" if graded and "error" in graded else "")
    row["wrong_exclusions"] = len(wrong)
    row["wrong_exclusion_details"] = wrong
    row["must_not"] = len(mn)
    row["must_not_details"] = mn

    if links is not None:
        row.update(await links.check(rec_urls(plan)))
    else:
        row.update(links_ok=0, links_total=0, bad_links=[])
    return row


# ---------------------------------------------------------------- report


def pct(a: float, b: float) -> str:
    return "n/a" if not b else f"{100 * a / b:.0f}%"


def build_report(rows: list[dict], meta: dict) -> tuple[str, dict]:
    S = lambda k: sum(r.get(k, 0) for r in rows)  # noqa: E731
    hit, tot = S("cat_hit") + S("any_hit"), S("cat_total") + S("any_total")
    times = [r["seconds"] for r in rows if not r["error"]]
    summary = {
        "profiles": len(rows),
        "errors": sum(1 for r in rows if r["error"]),
        "recall": hit / tot if tot else 0.0,
        "category_recall": S("cat_hit") / S("cat_total") if S("cat_total") else 0.0,
        "any_recall": S("any_hit") / S("any_total") if S("any_total") else 0.0,
        "gray_kept": S("gray_kept") / S("gray_total") if S("gray_total") else 1.0,
        "wrong_exclusions": S("wrong_exclusions"),
        "must_not": S("must_not"),
        "invented": S("invented"),
        "web_unverified": S("web_unverified"),
        "links": S("links_ok") / S("links_total") if S("links_total") else None,
        "seconds_avg": sum(times) / len(times) if times else None,
        "seconds_max": max(times) if times else None,
    }

    def mark(ok: bool | None) -> str:
        return "n/a" if ok is None else ("PASS" if ok else "FAIL")

    L = []
    L.append("# Eval report\n")
    L.append(f"- Run: `{meta['run_dir']}`  ")
    L.append(f"- Pipeline: {'FAKE (evals/fake_pipeline.py)' if meta['fake'] else 'app.pipeline.run_pipeline'}  ")
    L.append(f"- Profiles: {summary['profiles']} ({summary['errors']} errors), concurrency {meta['concurrency']}  ")
    L.append(f"- {meta['grader_note']}  ")
    L.append(f"- Links: {'checked (httpx, 8s timeout)' if meta['links'] else 'skipped (--no-links)'}\n")

    L.append("## Summary\n")
    L.append("| Metric | Value | Target | Status |")
    L.append("| --- | --- | --- | --- |")
    L.append(f"| Must-include recall (categories + keyword groups) | {pct(hit, tot)} ({hit}/{tot}) | >= 85% | {mark(summary['recall'] >= TARGETS['recall'])} |")
    L.append(f"| - category recall | {pct(S('cat_hit'), S('cat_total'))} | | |")
    L.append(f"| - keyword-group recall | {pct(S('any_hit'), S('any_total'))} | | |")
    L.append(f"| Gray areas kept | {pct(S('gray_kept'), S('gray_total'))} ({S('gray_kept')}/{S('gray_total')}) | 100% | {mark(summary['gray_kept'] >= TARGETS['gray_kept'])} |")
    L.append(f"| Wrong exclusions | {summary['wrong_exclusions']} | 0 | {mark(summary['wrong_exclusions'] == 0)} |")
    L.append(f"| Must-not violations | {summary['must_not']} | 0 | {mark(summary['must_not'] == 0)} |")
    L.append(f"| Invented (no source_url) | {summary['invented']} | 0 | {mark(summary['invented'] == 0)} |")
    L.append(f"| Web sources not seen in tool_call events (info) | {summary['web_unverified']} | | |")
    lk = summary["links"]
    L.append(f"| Working links | {'n/a' if lk is None else pct(S('links_ok'), S('links_total'))} ({S('links_ok')}/{S('links_total')}) | >= 90% | {mark(None if lk is None else lk >= TARGETS['links'])} |")
    sa, sm = summary["seconds_avg"], summary["seconds_max"]
    L.append(f"| Seconds per run (avg / max) | {'n/a' if sa is None else f'{sa:.1f} / {sm:.1f}'} | <= 90s | {mark(None if sm is None else sm <= TARGETS['seconds'])} |")
    L.append(f"| Pipeline errors | {summary['errors']} | 0 | {mark(summary['errors'] == 0)} |\n")

    L.append("## Per profile\n")
    L.append("| Profile | Status | Cat recall | Group recall | Gray kept | Wrong excl. | Must-not | Invented | Links ok | Recs/Excl | Sec |")
    L.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for r in rows:
        st = "ok" if not r["error"] else "ERROR"
        L.append(
            f"| {r['id']} | {st} | {r['cat_hit']}/{r['cat_total']} | {r['any_hit']}/{r['any_total']} | "
            f"{r['gray_kept']}/{r['gray_total']} | {r['wrong_exclusions']} | {r['must_not']} | {r['invented']} | "
            f"{r['links_ok']}/{r['links_total']} | {r['n_recommended']}/{r['n_excluded']} | {r['seconds']} |"
        )

    L.append("\n## Details (misses and violations)\n")
    any_detail = False
    for r in rows:
        items = []
        if r["error"]:
            items.append(f"pipeline error: `{r['error'][:300]}`")
        if r.get("missing_categories"):
            items.append("missing categories: " + ", ".join(r["missing_categories"]))
        for g in r.get("missing_groups", []):
            items.append("missing any of: " + ", ".join(g))
        for g in r.get("gray_details", []):
            if g["status"] != "kept":
                extra = f" ({g.get('name')}: {g.get('reason')})" if g["status"] == "EXCLUDED" else ""
                items.append(f"gray area `{g['keyword']}` {g['status']}{extra}")
        for w in r.get("wrong_exclusion_details", []):
            items.append(f"wrong exclusion: {w.get('name')} - {w.get('why')}")
        for v in r.get("must_not_details", []):
            items.append(f"must-not ({v['by']}): {v.get('candidate')} violates `{v.get('rule')or v.get('why') or v['rule_index']}`")
        for n in r.get("invented_names", []):
            items.append(f"no source_url: {n}")
        for b in r.get("bad_links", []):
            items.append(f"bad link ({b['status']}): {b['url']}")
        if items:
            any_detail = True
            L.append(f"**{r['id']}**\n")
            L.extend(f"- {i}" for i in items)
            L.append("")
    if not any_detail:
        L.append("No misses.\n")
    return "\n".join(L) + "\n", summary


# ---------------------------------------------------------------- main


async def main_async(args) -> int:
    profiles = load_profiles()
    expected = load_expected()
    if args.ids:
        want = [s.strip() for s in args.ids.split(",") if s.strip()]
        unknown = set(want) - {p["id"] for p in profiles}
        if unknown:
            print(f"Unknown ids: {', '.join(sorted(unknown))}", file=sys.stderr)
            return 2
        profiles = [p for p in profiles if p["id"] in want]
    if args.presets:
        profiles = [p for p in profiles if p.get("preset")]
    if args.limit:
        profiles = profiles[: args.limit]

    run_dir = EVALS_DIR / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=True)
    run_pipeline = get_pipeline(args.fake)
    grader = Grader(enabled=not args.no_llm)
    links = None if args.no_links else LinkChecker()
    print(f"Running {len(profiles)} profiles ({'fake' if args.fake else 'real'} pipeline, concurrency {args.concurrency}) -> {run_dir}")
    print(grader.note)

    sem = asyncio.Semaphore(args.concurrency)

    async def one(p: dict) -> dict:
        async with sem:
            result = await run_one(run_pipeline, p, run_dir, args.timeout)
        return await score(result, p, expected.get(p["id"], {}), grader, links)

    try:
        rows = await asyncio.gather(*(one(p) for p in profiles))
    finally:
        if links:
            await links.close()

    meta = {
        "run_dir": str(run_dir.relative_to(ROOT)),
        "fake": args.fake,
        "concurrency": args.concurrency,
        "grader_note": grader.note,
        "links": links is not None,
    }
    report, summary = build_report(rows, meta)
    (run_dir / "report.md").write_text(report)
    (EVALS_DIR / "report.md").write_text(report)
    (run_dir / "summary.json").write_text(json.dumps({"summary": summary, "meta": meta, "rows": rows}, indent=2, default=str))
    print()
    print(report)
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description="Run reentry pipeline evals")
    ap.add_argument("--ids", help="comma-separated profile ids")
    ap.add_argument("--limit", type=int, help="only the first N profiles (after --ids/--presets)")
    ap.add_argument("--presets", action="store_true", help="only the 4 demo preset profiles")
    ap.add_argument("--concurrency", type=int, default=3, help="profiles run at once (default 3)")
    ap.add_argument("--fake", action="store_true", help="use evals/fake_pipeline.py instead of app.pipeline")
    ap.add_argument("--no-llm", action="store_true", help="skip the LLM grader (heuristic wrong-exclusion check)")
    ap.add_argument("--no-links", action="store_true", help="skip HTTP link checks")
    ap.add_argument("--timeout", type=float, default=300.0, help="per-profile pipeline timeout in seconds (default 300)")
    args = ap.parse_args()
    sys.exit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
