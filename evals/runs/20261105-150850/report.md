# Eval report

- Run: `evals/runs/20261105-150850`  
- Pipeline: FAKE (evals/fake_pipeline.py)  
- Profiles: 2 (0 errors), concurrency 3  
- LLM grader: claude-opus-5-5.  
- Links: skipped (--no-links)

## Summary

| Metric | Value | Target | Status |
| --- | --- | --- | --- |
| Must-include recall (categories + keyword groups) | 100% (17/17) | >= 85% | PASS |
| - category recall | 100% | | |
| - keyword-group recall | 100% | | |
| Gray areas kept | 100% (5/5) | 100% | PASS |
| Wrong exclusions | 4 | 0 | FAIL |
| Must-not violations | 0 | 0 | PASS |
| Invented (no source_url) | 0 | 0 | PASS |
| Web sources not seen in tool_call events (info) | 4 | | |
| Working links | n/a (0/0) | >= 90% | n/a |
| Seconds per run (avg / max) | 0.2 / 0.2 | <= 90s | PASS |
| Pipeline errors | 0 | 0 | PASS |

## Per profile

| Profile | Status | Cat recall | Group recall | Gray kept | Wrong excl. | Must-not | Invented | Links ok | Recs/Excl | Sec |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| anthony-sf | ok | 5/5 | 5/5 | 2/2 | 2 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| rosa-fresno | ok | 3/3 | 4/4 | 3/3 | 2 | 0 | 0 | 0/0 | 14/2 | 0.2 |

## Details (misses and violations)

**anthony-sf**

- wrong exclusion: Veterans transitional housing (VA GPD) - The GPD veteran-only rule is real, but the profile has no veteran-status field. The exclusion rests on missing information, not a known disqualifier. It should be worth_applying with a question to confirm military service.
- wrong exclusion: Downtown men's shelter - No rule is cited, and the reason is only that bed availability is unknown. Missing information can never justify exclusion, and a men's shelter fits this unhoused man.

**rosa-fresno**

- wrong exclusion: Veterans transitional housing (VA GPD) - The VA GPD veteran-only rule is real, but the profile says nothing either way about military service. The exclusion rests on missing information, not a known disqualifier, so it should be worth_applying with a question confirming veteran status.
- wrong exclusion: Downtown men's shelter - The reason cites no written rule; it relies only on unknown bed availability. Missing information is never a valid basis for not_eligible.

