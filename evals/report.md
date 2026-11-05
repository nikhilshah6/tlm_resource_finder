# Eval report

- Run: `evals/runs/20261105-152700`  
- Pipeline: app.pipeline.run_pipeline  
- Profiles: 18 (0 errors), concurrency 4  
- LLM grader: claude-opus-5-5.  
- Links: checked (httpx, 8s timeout)

## Summary

| Metric | Value | Target | Status |
| --- | --- | --- | --- |
| Must-include recall (categories + keyword groups) | 99% (144/145) | >= 85% | PASS |
| - category recall | 100% | | |
| - keyword-group recall | 99% | | |
| Gray areas kept | 100% (32/32) | 100% | PASS |
| Wrong exclusions | 0 | 0 | PASS |
| Must-not violations | 6 | 0 | FAIL |
| Invented (no source_url) | 0 | 0 | PASS |
| Web sources not seen in tool_call events (info) | 42 | | |
| Working links | 88% (234/266) | >= 90% | FAIL |
| Seconds per run (avg / max) | 92.9 / 105.3 | <= 90s | FAIL |
| Pipeline errors | 0 | 0 | PASS |

## Per profile

| Profile | Status | Cat recall | Group recall | Gray kept | Wrong excl. | Must-not | Invented | Links ok | Recs/Excl | Sec |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| marcus-oakland | ok | 5/5 | 6/6 | 2/2 | 0 | 0 | 0 | 13/15 | 15/0 | 86.3 |
| anthony-sf | ok | 5/5 | 5/5 | 2/2 | 0 | 0 | 0 | 10/12 | 15/0 | 97.6 |
| lashonda-la | ok | 5/5 | 4/4 | 3/3 | 0 | 0 | 0 | 17/18 | 18/0 | 100.9 |
| rosa-fresno | ok | 3/3 | 4/4 | 3/3 | 0 | 0 | 0 | 14/15 | 15/1 | 105.3 |
| devon-la-registrant | ok | 4/4 | 5/5 | 1/1 | 0 | 0 | 0 | 15/15 | 15/0 | 98.0 |
| jamie-sandiego | ok | 4/4 | 3/3 | 2/2 | 0 | 0 | 0 | 13/15 | 15/0 | 100.2 |
| luis-riverside-cdl | ok | 4/4 | 4/4 | 2/2 | 0 | 0 | 0 | 9/15 | 17/0 | 92.4 |
| keisha-sacramento | ok | 3/3 | 3/3 | 2/2 | 0 | 0 | 0 | 14/15 | 15/0 | 84.5 |
| tomas-bakersfield | ok | 3/3 | 3/3 | 1/1 | 0 | 0 | 0 | 12/12 | 12/0 | 79.0 |
| darnell-oakland | ok | 4/4 | 5/5 | 2/2 | 0 | 0 | 0 | 11/14 | 15/0 | 82.7 |
| maria-sandiego-mom | ok | 4/4 | 4/4 | 1/1 | 0 | 0 | 0 | 14/15 | 18/1 | 96.6 |
| kevin-fresno-cdl | ok | 4/4 | 4/4 | 2/2 | 0 | 0 | 0 | 13/15 | 15/1 | 93.9 |
| tanya-riverside | ok | 4/4 | 4/4 | 2/2 | 0 | 1 | 0 | 11/14 | 15/0 | 90.0 |
| eddie-sf-registrant | ok | 3/3 | 3/3 | 1/1 | 0 | 5 | 0 | 13/15 | 15/0 | 95.8 |
| andre-longbeach | ok | 3/3 | 4/4 | 1/1 | 0 | 0 | 0 | 13/15 | 15/0 | 96.8 |
| brenda-sacramento | ok | 4/4 | 5/5 | 2/2 | 0 | 0 | 0 | 13/14 | 14/0 | 92.0 |
| ray-kern | ok | 4/4 | 4/5 | 2/2 | 0 | 0 | 0 | 13/15 | 15/1 | 86.8 |
| nina-oakland-lgbtq | ok | 4/4 | 4/4 | 1/1 | 0 | 0 | 0 | 16/17 | 17/0 | 93.4 |

## Details (misses and violations)

**marcus-oakland**

- bad link (ConnectTimeout): https://www.rootandrebound.org/
- bad link (403): https://www.lifelongmedical.org/

**anthony-sf**

- bad link (ConnectTimeout): https://www.rootandrebound.org/
- bad link (404): https://www.arribajuntos.org/location/career-link-center-mission

**lashonda-la**

- bad link (404): https://anewwayoflife.org/our-work/

**rosa-fresno**

- bad link (ConnectError): https://www.fresnocounty.ca.gov/Departments/Behavioral-Health

**jamie-sandiego**

- bad link (403): https://thecentersd.org/housing-services/
- bad link (403): https://thecentersd.org/behavioral-health-services

**luis-riverside-cdl**

- bad link (404): https://www.dmv.ca.gov/portal/driver-education-and-safety/dmv-safety-guidelines-activities/statewide-ignition-interlock-device-pilot-program/
- bad link (403): https://rivcodpss.org/dpss-office-locations-calworks-calfresh-child-care-general-assistance-medi-cal-welfare-work
- bad link (ConnectError): https://www.csarivca.org
- bad link (ConnectError): https://www.rivcoworkforce.com/job-seeker-resources
- bad link (403): https://rivcodpss.org/rental-assistance
- bad link (500): https://data.hud.gov/Housing_Counselor/

**keisha-sacramento**

- bad link (404): https://www.saccourt.ca.gov/ud/resources.aspx/1000

**darnell-oakland**

- bad link (ConnectError): https://westoaklandhealth.org/
- bad link (ConnectTimeout): https://www.rootandrebound.org/
- bad link (404): https://www.merritt.edu/campus-map/

**maria-sandiego-mom**

- bad link (ConnectError): https://www.southbaycommunityservices.org

**kevin-fresno-cdl**

- bad link (500): https://data.hud.gov/Housing_Counselor/
- bad link (403): https://www.yelp.com/biz/dmv-dot-physical-exam-at-sandhu-clinic-fresno

**tanya-riverside**

- must-not (county check): Time for Change Foundation — Women's Reentry Program violates `No in-person programs located outside Riverside County unless statewide or online (parole/probation county restriction)`
- bad link (403): https://rivcodpss.org/dpss-office-locations-calworks-calfresh-child-care-general-assistance-medi-cal-welfare-work
- bad link (410): https://feedam.org/resource/128615
- bad link (ConnectError): https://www.rivcoworkforce.com/job-seeker-resources

**eddie-sf-registrant**

- must-not (registrant text): Asian Inc (HUD-approved housing counseling) violates `No family, children's, or youth housing/shelters whose written rules exclude sex registrants (PC 290), and no housing within restricted distance of schools/parks if the program says registrants are barred`
- must-not (registrant text): San Francisco Housing Development Corporation violates `No family, children's, or youth housing/shelters whose written rules exclude sex registrants (PC 290), and no housing within restricted distance of schools/parks if the program says registrants are barred`
- must-not (registrant text): SF Public Defender Clean Slate (record clearance) violates `No family, children's, or youth housing/shelters whose written rules exclude sex registrants (PC 290), and no housing within restricted distance of schools/parks if the program says registrants are barred`
- must-not (registrant text): Arriba Juntos - Career Link Center - Civic Center violates `No family, children's, or youth housing/shelters whose written rules exclude sex registrants (PC 290), and no housing within restricted distance of schools/parks if the program says registrants are barred`
- must-not (keyword): Arriba Juntos - Career Link Center - Civic Center violates `youth`
- bad link (404): https://www.sf.gov/reports/august-2022/catalog-reentry-services
- bad link (404): https://www.arribajuntos.org/locations/career-link-center-civic-center

**andre-longbeach**

- bad link (410): https://dhs.lacounty.gov/longbeach/
- bad link (403): https://www.yelp.com/biz/forklift-training-and-employment-center-long-beach

**brenda-sacramento**

- bad link (403): https://www.yelp.com/biz/social-security-sacramento-3

**ray-kern**

- missing any of: Social Security, SSA, SSN
- bad link (ConnectTimeout): https://rootandrebound.org
- bad link (500): https://www.themissionkc.org

**nina-oakland-lgbtq**

- bad link (404): https://ceoworks.org/locations/oakland-ca

