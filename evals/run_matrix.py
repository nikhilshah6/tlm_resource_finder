"""Run the eval set once per lead/worker model combination and compare quality, speed and cost.

Usage (from the repo root):
    .venv/bin/python evals/run_matrix.py --presets                 # pilot: 4 demo profiles x 5 combos
    .venv/bin/python evals/run_matrix.py                           # all 18 profiles x 5 combos
    .venv/bin/python evals/run_matrix.py --combos opus-sonnet,sonnet-haiku --ids marcus-oakland --no-links
    .venv/bin/python evals/run_matrix.py --report-only evals/runs/matrix-<ts>   # rebuild the report

Each combo runs evals/run_evals.py in its own process with LEAD_MODEL / WORKER_MODEL set and server-side
fallbacks off (so a fallback can't swap models mid-run). Writes evals/runs/matrix-<ts>/<combo>/ and
evals/runs/matrix-<ts>/matrix-report.md (+ matrix.json), and copies the report to evals/matrix-report.md.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

EVALS = Path(__file__).resolve().parent
ROOT = EVALS.parent
M = {"fable": "claude-fable-5-1", "opus": "claude-opus-5-5", "sonnet": "claude-sonnet-5-5", "haiku": "claude-haiku-5-5"}
COMBOS = ["fable-opus", "opus-opus", "opus-sonnet", "sonnet-sonnet", "sonnet-haiku"]  # lead-worker
BASELINE = "opus-sonnet"
PLANS_PER_MONTH = 1000 * 2  # ~1,000 alumni, 2 plans a month each


def run_combo(combo: str, out: Path, passthrough: list[str]) -> int:
    lead, worker = combo.split("-")
    env = dict(os.environ, LEAD_MODEL=M[lead], WORKER_MODEL=M[worker], USE_FALLBACKS="0")
    cmd = [sys.executable, str(EVALS / "run_evals.py"), "--out-dir", str(out / combo), "--no-latest", *passthrough]
    log = open(out / f"{combo}.log", "w")
    print(f"[{combo}] lead {M[lead]}, workers {M[worker]} -> {out / combo}", flush=True)
    rc = subprocess.call(cmd, env=env, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
    print(f"[{combo}] finished (exit {rc})", flush=True)
    return rc


def money(x) -> str:
    return "n/a" if x is None else (f"${x:.2f}" if x >= 1 else f"${x:.3f}")


def pct(x) -> str:
    return "n/a" if x is None else f"{100 * x:.0f}%"


def build(out: Path) -> str:
    rows = {}
    for combo in COMBOS:
        f = out / combo / "summary.json"
        if f.exists():
            rows[combo] = json.loads(f.read_text())
    if not rows:
        raise SystemExit(f"no combo results under {out}")
    S = {c: r["summary"] for c, r in rows.items()}
    L = [f"# Model matrix: lead / worker combinations\n", f"Run: `{out.relative_to(ROOT)}` · profiles per combo: "
         + ", ".join(f"{c} {S[c]['profiles']}" for c in S) + " · grader: claude-opus-5-5 (same for every combo)\n",
         "Lead = orchestrator, eligibility judge, ranker. Workers = intake and the 5 finders. Effort levels are the same in every combo.\n"]

    L.append("## Quality\n")
    L.append("| Combo | Recall | Gray kept | Wrong excl. | Must-not | Invented | Working links | Reentry-specific recs | Schema repairs | Errors |")
    L.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for c, s in S.items():
        L.append(f"| {c} | {pct(s['recall'])} | {pct(s['gray_kept'])} | {s['wrong_exclusions']} | {s['must_not']} | {s['invented']} | {pct(s['links'])} | {pct(s.get('reentry_share'))} | {s.get('schema_repairs', 0)} | {s['errors']} |")

    L.append("\n## Alumni-facing steps (the `for_alumnus` text)\n")
    L.append("| Combo | Steps | Reading grade (FK) | Third-person leaks | Staff-only leaks | Missing |")
    L.append("| --- | --- | --- | --- | --- | --- |")
    for c, s in S.items():
        fk = s.get("steps_fk_avg")
        L.append(f"| {c} | {s.get('steps_n', 0)} | {'n/a' if fk is None else f'{fk:.1f}'} | {s.get('steps_third_person', 0)} | {s.get('steps_staff_leak', 0)} | {s.get('steps_missing_for_alumnus', 0)} |")

    L.append("\n## Speed\n")
    L.append("| Combo | p50 s | p90 s | max s |\n| --- | --- | --- | --- |")
    for c, s in S.items():
        f = lambda k: "n/a" if s.get(k) is None else f"{s[k]:.0f}"  # noqa: E731
        L.append(f"| {c} | {f('seconds_p50')} | {f('seconds_p90')} | {f('seconds_max')} |")

    # cost: aggregate per-plan usage
    L.append("\n## Cost per plan\n")
    L.append("| Combo | $ / plan | Input | Cache write | Cache read | Output | Web search | Lead $ | Workers $ | $ per 1,000 plans | TLM month (2,000 plans) |")
    L.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    agg = {}
    for c, r in rows.items():
        plans = [row["usage"] for row in r["rows"] if row.get("usage")]
        n = len(plans) or 1
        k = {kk: sum(p["usd"][kk] for p in plans) / n for kk in ("input", "cache_write", "cache_read", "output", "web_search", "total")}
        role = {rr: sum((p["by_role"].get(rr) or {}).get("usd", 0) for p in plans) / n for rr in ("lead", "worker")}
        agents = {}
        for p in plans:
            for a, b in p["by_agent"].items():
                x = agents.setdefault(a, {"usd": 0.0, "input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 0, "web_search_requests": 0, "calls": 0})
                for kk in x:
                    x[kk] += b.get(kk, 0)
        agents = {a: {kk: v / n for kk, v in x.items()} for a, x in agents.items()}
        tok = {kk: sum(p["tokens"][kk] for p in plans) / n for kk in plans[0]["tokens"]} if plans else {}
        agg[c] = {"usd": k, "role": role, "agents": agents, "tokens": tok, "plans": len(plans)}
        L.append(f"| {c} | **{money(k['total'])}** | {money(k['input'])} | {money(k['cache_write'])} | {money(k['cache_read'])} | {money(k['output'])} | {money(k['web_search'])} | {money(role['lead'])} | {money(role['worker'])} | {money(k['total'] * 1000)} | {money(k['total'] * PLANS_PER_MONTH)} |")

    L.append("\n## Tokens per plan\n")
    L.append("| Combo | API calls | Input (uncached) | Cache write | Cache read | Output | Web searches | Web fetches |")
    L.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for c, a in agg.items():
        t = a["tokens"]
        if t:
            L.append(f"| {c} | {t['calls']:.0f} | {t['input_tokens']:,.0f} | {t['cache_creation_input_tokens']:,.0f} | {t['cache_read_input_tokens']:,.0f} | {t['output_tokens']:,.0f} | {t['web_search_requests']:.1f} | {t['web_fetch_requests']:.1f} |")

    L.append("\n## Cost and tokens by agent (per plan)\n")
    order = ["intake", "orchestrator", "finders", "eligibility", "ranker"]
    L.append("| Combo | " + " | ".join(order) + " |")
    L.append("| --- |" + " --- |" * len(order))
    for c, a in agg.items():
        cells = []
        for ag in order:
            x = a["agents"].get(ag)
            cells.append("—" if not x else f"{money(x['usd'])} · {x['input_tokens'] / 1000:.0f}K in / {x['output_tokens'] / 1000:.1f}K out")
        L.append(f"| {c} | " + " | ".join(cells) + " |")

    if BASELINE in agg:
        b = agg[BASELINE]["usd"]["total"] or 1e-9
        bs = S[BASELINE]
        L.append(f"\n## Against the current setup ({BASELINE})\n")
        L.append("| Combo | Cost vs baseline | Recall vs baseline | Gray kept vs baseline | Speed (p50) vs baseline | Recall points per $ |")
        L.append("| --- | --- | --- | --- | --- | --- |")
        for c, a in agg.items():
            s = S[c]
            dr = (s["recall"] - bs["recall"]) * 100
            dg = (s["gray_kept"] - bs["gray_kept"]) * 100
            ds = (s["seconds_p50"] or 0) - (bs["seconds_p50"] or 0)
            L.append(f"| {c} | {a['usd']['total'] / b:.2f}× | {dr:+.0f} pts | {dg:+.0f} pts | {ds:+.0f} s | {100 * s['recall'] / max(a['usd']['total'], 1e-9):.0f} |")

    flags = [(c, s) for c, s in S.items() if s.get("served_model_mismatches") or s.get("legacy_web_tool_calls")]
    L.append("\n## Notes\n")
    L.append("- Prices: platform.claude.com pricing page, Nov 6, 2026 (`evals/pricing.py`). Web search $10 per 1,000; web fetch is tokens only; cache writes at the 5-minute rate.")
    L.append("- Haiku 5.5's tokenizer counts about 30% more tokens for the same text, so its token counts aren't directly comparable.")
    L.append("- Grader cost (Opus 5.5, same for every combo) is excluded from $ / plan: " + ", ".join(f"{c} {money(s.get('grader_usd'))}" for c, s in S.items()) + ".")
    for c, s in flags:
        L.append(f"- {c}: {s.get('served_model_mismatches', 0)} calls served by a different model; {s.get('legacy_web_tool_calls', 0)} calls used the earlier web tools (the model rejected the 20260209 versions).")
    report = "\n".join(L) + "\n"
    (out / "matrix-report.md").write_text(report)
    (out / "matrix.json").write_text(json.dumps({"summaries": S, "cost": agg}, indent=2, default=str))
    (EVALS / "matrix-report.md").write_text(report)
    return report


def main() -> None:
    ap = argparse.ArgumentParser(description="Eval matrix over lead/worker model combinations")
    ap.add_argument("--combos", default=",".join(COMBOS), help="comma-separated lead-worker combos")
    ap.add_argument("--parallel", type=int, default=2, help="combos run at once (default 2)")
    ap.add_argument("--out", help="matrix folder (default evals/runs/matrix-<timestamp>)")
    ap.add_argument("--report-only", help="rebuild the report from an existing matrix folder")
    args, passthrough = ap.parse_known_args()
    if args.report_only:
        print(build(Path(args.report_only).resolve()))
        return
    combos = [c.strip() for c in args.combos.split(",") if c.strip()]
    bad = [c for c in combos if c not in COMBOS]
    if bad:
        raise SystemExit(f"unknown combos: {bad}; choose from {COMBOS}")
    out = Path(args.out).resolve() if args.out else EVALS / "runs" / f"matrix-{datetime.now():%Y%m%d-%H%M%S}"
    out.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=args.parallel) as ex:
        rcs = list(ex.map(lambda c: run_combo(c, out, passthrough), combos))
    print(build(out))
    if any(rcs):
        print(f"some combos exited non-zero: {dict(zip(combos, rcs))}; see the .log files in {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
