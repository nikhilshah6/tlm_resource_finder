# Eval report

- Run: `evals/runs/20261105-150858`  
- Pipeline: FAKE (evals/fake_pipeline.py)  
- Profiles: 1 (0 errors), concurrency 3  
- LLM grader: claude-opus-5-5.  
- Links: skipped (--no-links)

## Summary

| Metric | Value | Target | Status |
| --- | --- | --- | --- |
| Must-include recall (categories + keyword groups) | 100% (11/11) | >= 85% | PASS |
| - category recall | 100% | | |
| - keyword-group recall | 100% | | |
| Gray areas kept | 100% (2/2) | 100% | PASS |
| Wrong exclusions | 1 | 0 | FAIL |
| Must-not violations | 0 | 0 | PASS |
| Invented (no source_url) | 0 | 0 | PASS |
| Web sources not seen in tool_call events (info) | 2 | | |
| Working links | n/a (0/0) | >= 90% | n/a |
| Seconds per run (avg / max) | 0.2 / 0.2 | <= 90s | PASS |
| Pipeline errors | 0 | 0 | PASS |

## Per profile

| Profile | Status | Cat recall | Group recall | Gray kept | Wrong excl. | Must-not | Invented | Links ok | Recs/Excl | Sec |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| marcus-oakland | ok | 5/5 | 6/6 | 2/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |

## Details (misses and violations)

**marcus-oakland**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

