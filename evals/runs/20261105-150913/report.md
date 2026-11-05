# Eval report

- Run: `evals/runs/20261105-150913`  
- Pipeline: FAKE (evals/fake_pipeline.py)  
- Profiles: 18 (0 errors), concurrency 3  
- LLM grader disabled (--no-llm); heuristic used for wrong exclusions.  
- Links: skipped (--no-links)

## Summary

| Metric | Value | Target | Status |
| --- | --- | --- | --- |
| Must-include recall (categories + keyword groups) | 99% (143/145) | >= 85% | PASS |
| - category recall | 100% | | |
| - keyword-group recall | 97% | | |
| Gray areas kept | 94% (30/32) | 100% | FAIL |
| Wrong exclusions | 18 | 0 | FAIL |
| Must-not violations | 0 | 0 | PASS |
| Invented (no source_url) | 0 | 0 | PASS |
| Web sources not seen in tool_call events (info) | 36 | | |
| Working links | n/a (0/0) | >= 90% | n/a |
| Seconds per run (avg / max) | 0.2 / 0.2 | <= 90s | PASS |
| Pipeline errors | 0 | 0 | PASS |

## Per profile

| Profile | Status | Cat recall | Group recall | Gray kept | Wrong excl. | Must-not | Invented | Links ok | Recs/Excl | Sec |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| marcus-oakland | ok | 5/5 | 6/6 | 2/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| anthony-sf | ok | 5/5 | 5/5 | 2/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| lashonda-la | ok | 5/5 | 4/4 | 3/3 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| rosa-fresno | ok | 3/3 | 4/4 | 3/3 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| devon-la-registrant | ok | 4/4 | 5/5 | 1/1 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| jamie-sandiego | ok | 4/4 | 3/3 | 1/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| luis-riverside-cdl | ok | 4/4 | 4/4 | 2/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| keisha-sacramento | ok | 3/3 | 2/3 | 1/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| tomas-bakersfield | ok | 3/3 | 3/3 | 1/1 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| darnell-oakland | ok | 4/4 | 5/5 | 2/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.1 |
| maria-sandiego-mom | ok | 4/4 | 4/4 | 1/1 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| kevin-fresno-cdl | ok | 4/4 | 4/4 | 2/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| tanya-riverside | ok | 4/4 | 4/4 | 2/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| eddie-sf-registrant | ok | 3/3 | 3/3 | 1/1 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| andre-longbeach | ok | 3/3 | 4/4 | 1/1 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| brenda-sacramento | ok | 4/4 | 5/5 | 2/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.2 |
| ray-kern | ok | 4/4 | 5/5 | 2/2 | 1 | 0 | 0 | 0/0 | 14/2 | 0.1 |
| nina-oakland-lgbtq | ok | 4/4 | 3/4 | 1/1 | 1 | 0 | 0 | 0/0 | 14/2 | 0.1 |

## Details (misses and violations)

**marcus-oakland**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**anthony-sf**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**lashonda-la**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**rosa-fresno**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**devon-la-registrant**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**jamie-sandiego**

- gray area `women` missing
- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**luis-riverside-cdl**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**keisha-sacramento**

- missing any of: culinary, kitchen, food service, chef, Homeboy
- gray area `culinary` missing
- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**tomas-bakersfield**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**darnell-oakland**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**maria-sandiego-mom**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**kevin-fresno-cdl**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**tanya-riverside**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**eddie-sf-registrant**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**andre-longbeach**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**brenda-sacramento**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**ray-kern**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

**nina-oakland-lgbtq**

- missing any of: mental health, counseling, behavioral
- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)

