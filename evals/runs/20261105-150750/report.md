# Eval report

- Run: `evals/runs/20261105-150750`  
- Pipeline: FAKE (evals/fake_pipeline.py)  
- Profiles: 18 (0 errors), concurrency 3  
- LLM grader disabled (--no-llm); heuristic used for wrong exclusions.  
- Links: checked (httpx, 8s timeout)

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
| Working links | 67% (156/234) | >= 90% | FAIL |
| Seconds per run (avg / max) | 0.2 / 0.2 | <= 90s | PASS |
| Pipeline errors | 0 | 0 | PASS |

## Per profile

| Profile | Status | Cat recall | Group recall | Gray kept | Wrong excl. | Must-not | Invented | Links ok | Recs/Excl | Sec |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| marcus-oakland | ok | 5/5 | 6/6 | 2/2 | 1 | 0 | 0 | 9/13 | 14/2 | 0.2 |
| anthony-sf | ok | 5/5 | 5/5 | 2/2 | 1 | 0 | 0 | 8/13 | 14/2 | 0.2 |
| lashonda-la | ok | 5/5 | 4/4 | 3/3 | 1 | 0 | 0 | 9/13 | 14/2 | 0.2 |
| rosa-fresno | ok | 3/3 | 4/4 | 3/3 | 1 | 0 | 0 | 9/13 | 14/2 | 0.2 |
| devon-la-registrant | ok | 4/4 | 5/5 | 1/1 | 1 | 0 | 0 | 9/13 | 14/2 | 0.2 |
| jamie-sandiego | ok | 4/4 | 3/3 | 1/2 | 1 | 0 | 0 | 9/13 | 14/2 | 0.2 |
| luis-riverside-cdl | ok | 4/4 | 4/4 | 2/2 | 1 | 0 | 0 | 8/13 | 14/2 | 0.2 |
| keisha-sacramento | ok | 3/3 | 2/3 | 1/2 | 1 | 0 | 0 | 8/13 | 14/2 | 0.1 |
| tomas-bakersfield | ok | 3/3 | 3/3 | 1/1 | 1 | 0 | 0 | 9/13 | 14/2 | 0.2 |
| darnell-oakland | ok | 4/4 | 5/5 | 2/2 | 1 | 0 | 0 | 9/13 | 14/2 | 0.1 |
| maria-sandiego-mom | ok | 4/4 | 4/4 | 1/1 | 1 | 0 | 0 | 9/13 | 14/2 | 0.2 |
| kevin-fresno-cdl | ok | 4/4 | 4/4 | 2/2 | 1 | 0 | 0 | 9/13 | 14/2 | 0.2 |
| tanya-riverside | ok | 4/4 | 4/4 | 2/2 | 1 | 0 | 0 | 8/13 | 14/2 | 0.2 |
| eddie-sf-registrant | ok | 3/3 | 3/3 | 1/1 | 1 | 0 | 0 | 8/13 | 14/2 | 0.2 |
| andre-longbeach | ok | 3/3 | 4/4 | 1/1 | 1 | 0 | 0 | 9/13 | 14/2 | 0.2 |
| brenda-sacramento | ok | 4/4 | 5/5 | 2/2 | 1 | 0 | 0 | 8/13 | 14/2 | 0.2 |
| ray-kern | ok | 4/4 | 5/5 | 2/2 | 1 | 0 | 0 | 9/13 | 14/2 | 0.1 |
| nina-oakland-lgbtq | ok | 4/4 | 3/4 | 1/1 | 1 | 0 | 0 | 9/13 | 14/2 | 0.1 |

## Details (misses and violations)

**marcus-oakland**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**anthony-sf**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.sf.gov/apply-cash-assistance-caap
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**lashonda-la**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadError): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**rosa-fresno**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**devon-la-registrant**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**jamie-sandiego**

- gray area `women` missing
- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**luis-riverside-cdl**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (403): https://rivcodpss.org/
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**keisha-sacramento**

- missing any of: culinary, kitchen, food service, chef, Homeboy
- gray area `culinary` missing
- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://dhs.saccounty.gov/PRI/Pages/General-Assistance/GA-Home.aspx
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**tomas-bakersfield**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**darnell-oakland**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**maria-sandiego-mom**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadError): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**kevin-fresno-cdl**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadError): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**tanya-riverside**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadError): https://www.cdss.ca.gov/calfresh
- bad link (403): https://rivcodpss.org/
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**eddie-sf-registrant**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.sf.gov/apply-cash-assistance-caap
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**andre-longbeach**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadError): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**brenda-sacramento**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://dhs.saccounty.gov/PRI/Pages/General-Assistance/GA-Home.aspx
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**ray-kern**

- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

**nina-oakland-lgbtq**

- missing any of: mental health, counseling, behavioral
- wrong exclusion: Downtown men's shelter - no rule_cited or uncertain reason (heuristic)
- bad link (ReadTimeout): https://www.cdss.ca.gov/calfresh
- bad link (404): https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network
- bad link (404): https://www.cdcr.ca.gov/rehabilitative-programs/
- bad link (404): https://www.cdss.ca.gov/inforesources/child-welfare-programs

