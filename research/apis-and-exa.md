# Data sources, benefits APIs and Exa: research for the reentry resource finder

Prepared Nov 12, 2026, on branch `benefits-tiles`. Read-only research: no sign-ups, no keys, no paid calls. Live checks were keyless GET requests using generic places (Missoula ZIP 59801, Indianapolis) and no personal data. Anything I couldn't confirm is marked **unverified**.

## Summary

- **Our live APIs already work outside California.** On Nov 12, Zippopotam, FindTreatment.gov, the HUD housing counselor API, FDIC BankFind, the SSA field-office ArcGIS layer and the HUD public housing authority ArcGIS layer all returned Montana results; Zippopotam also returned Indiana results. Our own code is what limits us to California. City geocoding is hard-coded to `/us/ca/`. Web search is pinned to `region: "California"`. The prompts and the `NEIGHBORS` county table assume California, and the snapshot and rules exist for CA only. Fixing these is cheap and gives Indiana and Montana a working baseline.
- **For Medicaid and SNAP (the top priority), no single free API replaces `rules_ca.json`.** The reliable rule data are federal tables: the USDA FNS income limits, the BBCE state chart and the SNAP state directory; for Medicaid, KFF's expansion tracker and CMS data. All of them are HTML or PDF pages that change once a year. They should be parsed into generated `rules_<state>.json` files. **PolicyEngine** is the only engine that computes SNAP for a household in any state, and it needs only ages, income and state, no names. Its hosted API needs credentials requested by email, and the self-hosted version needs about 4 GB of RAM, so it can't run inside a Worker.
- **Fix now:** `rules_ca.json` still has FY2026 CalFresh figures (max allotment $298 for 1 person). FY2027 took effect Oct 1, 2026, and the max allotment for 1 person is now $306 ([FNS COLA](https://www.fns.usda.gov/snap/allotment/cola)). Separately, federal Medicaid work requirements start Jan 1, 2027, with an exemption for people recently released from incarceration. That rule is the most relevant to our users and isn't stored anywhere yet.
- **Resource directories:** 211's National Data Platform is the broadest (about 2M resources, 240+ 211s), but beyond the trial it needs partner approval and has a 5% fee on revenue-generating use. Indiana 211 is run by the state (FSSA). findhelp and Unite Us have no public developer API that I could find.
- **Exa: no, not now.** Details are in the Exa section. It wouldn't fix a gap our evals show (recall is 99%). It adds a Claude round trip per search when runs are already over the 90 s target, and it costs more per search than Claude's built-in search. Zero data retention needs an Enterprise plan. A one-day A/B test on rural and out-of-state profiles is designed below in case the team wants evidence.

## Ranked table

Ranked by value for the stated priorities: Medicaid and SNAP first, then states beyond CA, then free access and simplicity. Effort: S is under a day, M is 1 to 3 days, L is longer or depends on a partner.

| # | Source | What it gives | Key or partner | Cost | States | Effort | Status |
|---|---|---|---|---|---|---|---|
| 1 | USDA FNS SNAP tables: [COLA / income limits](https://www.fns.usda.gov/snap/allotment/cola), [BBCE state chart](https://fns-prod.azureedge.us/sites/default/files/resource-files/BBCE-States-Chart-June2026.pdf), [state directory](https://www.fns.usda.gov/snap/state-directory) | FY2027 gross and net limits and max allotments; each state's BBCE gross limit and asset test; each state's SNAP site, hotline and office list | None (HTML/PDF, no API) | Free | All | M | New |
| 2 | Medicaid status: [KFF expansion tracker](https://www.kff.org/affordable-care-act/state-indicator/state-activity-around-expanding-medicaid-under-the-affordable-care-act/), [data.medicaid.gov eligibility levels](https://data.medicaid.gov/api/1/datastore/query/d7e4cccb-1c56-5b5d-acce-5e7744c6d3b4/0?limit=3), [CMS contacts directory](https://www.cms.gov/apps/contacts/) | Expansion status, MAGI limits as % FPL, state Medicaid office contacts | None | Free | All | S–M | New |
| 3 | Make the existing live APIs state-agnostic, and add SSA, PHA and HRSA as finder tools | Treatment, housing counselors, PHAs, SSA offices, health centers and banks in any state | None | Free | All (tested MT, IN) | S | In use (CA only in code) |
| 4 | [PolicyEngine household API](https://policyengine.github.io/policyengine-household-api/) | Calculated SNAP benefit (and other programs) for a household of given size, income and state | Credentials by email to hello@policyengine.org, or self-host Docker (~4 GB RAM) | Free (unverified; no pricing published) | All | M | New |
| 5 | CareerOneStop: [AJC finder plus ReEntry Program Finder API](https://www.careeronestop.org/Developers/WebAPI/web-api.aspx) | Job centers and local reentry employment programs by ZIP, city or state | Free registration (userId + token) | Free | All | S | AJC in use (key not set); reentry API new |
| 6 | [211 National Data Platform](https://apiportal.211.org/) | About 2M community resources | Trial key; full access through the API Request Form and the local 211 | Free for internal use; 5% fee on revenue-generating use ([FAQ](https://register.211.org/Home/FAQs)) | 240+ 211s; Indiana and Montana coverage unverified | L | Python only (trial V1) |
| 7 | [Indiana 211 (FSSA)](https://www.in.gov/fssa/thehub/indiana-211/) | State-run resource database, in211.org search, 866-211-9966 | Partner (no API found) | Free to call or use | IN | L (partner) | New |
| 8 | State collateral-consequence and record rules: [NICCC](https://niccc.nationalreentryresourcecenter.org), [CCRC SNAP/TANF drug-felony survey](https://ccresourcecenter.org/national-snap-tanf-drug-felony-study/), [NRRC Clean Slate Clearinghouse](https://nationalreentryresourcecenter.org/cleanslate) | Written rules for the eligibility judge (drug-felony SNAP bans, record clearance) outside CA | None | Free | All | M (hand-checked) | ccresourcecenter linked; others new |
| 9 | [CMS Marketplace API](https://developer.cms.gov/marketplace-api/) eligibility estimates | Medicaid/CHIP eligibility estimate for a household | Key request form; keys expire every 60 days | Unverified | HealthCare.gov states (unverified) | M | New |
| 10 | State reentry guides: [Notre Dame Indiana Reentry Guide (2025)](https://socialconcerns.nd.edu/wp-content/uploads/2025/03/Indiana-Reentry-Guide_online-version.pdf), [IDOC re-entry programs](https://www.in.gov/idoc/divisions/re-entry/programs), [Montana DOC prerelease centers](https://cor.mt.gov/Facilities/PrereleaseCenters), [MT Reentry Report 2026](https://lmi.mt.gov/_docs/Publications/LMI-Pubs/Special-Reports-and-Studies/Reentry-Report-2026.pdf) | Snapshot seed records for IN and MT, the CDCR DAPO guide's equivalent | None | Free | IN, MT | M | New |
| 11 | [USAspending award search](https://api.usaspending.gov/) | Second Chance Act grantees in a state | None | Free | All (change the state filter) | S | In use (CA) |
| 12 | [Unite Us](https://uniteus.com/networks/montana/) / findhelp | Closed-loop referral networks; Unite Montana and Unite Indiana exist | Partner (no public API found) | Free for CBOs per Unite Us; findhelp pricing not published ([G2](https://www.g2.com/products/findhelp/pricing)) | MT, IN networks | L | New |
| 13 | [Exa](https://exa.ai/pricing) | Web search API with domain and date filters | Paid key | $7 per 1k searches plus $1 per 1k pages per content type | All | M | New (not recommended) |

## Task 1: sources the repo already uses

### Live APIs

All of the checks below were run Nov 12, 2026 with keyless GETs centered on Missoula, MT (59801) or Indianapolis, IN.

**Zippopotam geocoding** (`tools.ts` `geocode`, `apis.py`)
- **Covers:** ZIP or city to lat/lon. **Limits:** no county field, so the intake model has to infer the county. No SLA. The city lookup is hard-coded to `https://api.zippopotam.us/us/ca/{city}` (`tools.ts:55`, `apis.py:69`).
- **Outside CA:** yes. `/us/59801` returned Missoula, MT and `/us/in/indianapolis` returned 46201.
- **Better option:** the [Census Geocoder](https://geocoding.geo.census.gov/geocoder/) is keyless and returns county FIPS (**unverified**: I didn't test it). It would remove the guessed county and make neighbor lookups data-driven.
- **Change:** pass the state abbreviation into `geocode`.

**SAMHSA FindTreatment.gov locator** (`findTreatment`)
- **Covers:** substance use and mental health facilities near a lat/lon. The [developer guide](https://findtreatment.gov/assets/FindTreatment-Developer-Guide.pdf) says `sAddr` must be lat,lon and `limitValue` is in meters.
- **Limits:** facilities are surveyed once a year and listings go out of date (team catalog note).
- **Outside CA:** yes. 14 facilities came back within 25 miles of Missoula.
- **Better option:** none found.

**HUD Housing Counselor** (`hudCounselors`)
- **Covers:** HUD-approved counseling agencies near a point.
- **Limits:** a legacy API that HUD no longer actively maintains ([data.gov](https://catalog.data.gov/dataset/hud-approved-housing-counseling-agencies)), and the agencies are counselors, not beds.
- **Outside CA:** yes. It returned Homeword, Inc. in Missoula.
- **Plan for failure:** cache results and fall back to the data.gov download.

**FDIC BankFind** (`fdicBranches`)
- **Covers:** bank branches by state and city ([docs](https://api.fdic.gov/banks/docs/)).
- **Limits:** the FDIC says a key may be required later. It doesn't flag second-chance accounts.
- **Outside CA:** yes. It returned 29 branches in Missoula.
- **Change:** the tool filters `STALP:CA`, so take the state as a parameter.

**CareerOneStop AJC finder** (`careerOneStopAjc`, key needed)
- **Covers:** about 2,300 American Job Centers nationwide (team catalog).
- **Status:** works in every state once the free token is set, but `CAREERONESTOP_TOKEN` isn't set, so the tool is off.
- **Change:** the tool description says "America's Job Center of California" (`tools.ts:133`); make it generic.
- **Newer API:** CareerOneStop also has a **ReEntry Program Finder API** (`/v1/reentryprogramfinder/{userId}`) that searches reentry employment programs by ZIP, city or state, under the same registration ([API page](https://cloudfront.careeronestop.org/Developers/WebAPI/ReEntryPrograms/list-all-reentry-programs.aspx)). This is the live version of the XLSX the snapshot already uses. The response fields are **unverified** (the docs host didn't resolve when I tried).

**211 API at api.211.org** (Python only; trial key)
- **What we call:** `apis.py` calls `/search/v1/api/Search/Keyword`. That is the deprecated V1, which the team catalog notes is capped at 10 results per call.
- **V2:** Search, Query, Export, Suggest and Filter are "in preview", and some features are limited to 211s that contribute data ([portal](https://apiportal.211.org/)).
- **Full access:** goes through the [API Request Form](https://app.smartsheet.com/b/form/c334690c49cd477fb27c7c0176c52d1d) and United Way Worldwide. Use is free for internal purposes, with a 5% fee on revenue-generating use ([FAQ](https://register.211.org/Home/FAQs)).
- **Outside CA:** the network is national ("96% United States coverage" per the portal). Whether Indiana 211 (state-run) and Montana 211 contribute to the NDP is **unverified**.
- **Gap:** not wired into Cloudflare. Don't port the V1 call; wait for a V2 data product.

**SSA field offices (Esri ArcGIS)** (`site/lib/sources/live.js`)
- **Covers:** office address, phone and hours.
- **Limits:** an Esri-hosted copy of SSA data, not SSA's own service ([SSA locator](https://www.ssa.gov/locator/)).
- **Outside CA:** yes. A `STATE='MT'` query returned offices.
- **Gap:** used only by the instant "General resources" path, not by the agent finders. Add it to the `legal_id` finder.

**HUD Public Housing Authorities (ArcGIS)** (`live.js`)
- **Covers:** PHAs with phone numbers ([HUD open data](https://hudgis-hud.opendata.arcgis.com/datasets/HUD::public-housing-authorities)).
- **Outside CA:** yes. Montana PHAs returned.
- **Gap:** same as SSA. Add it to the `housing` finder.

**HRSA health center sites** (`live.js` plus `site/build.js`)
- **Covers:** sliding-fee health centers.
- **How it's built:** `build.js` downloads the national CSV and writes `data/hrsa/<state>.json` for every state, so it is already national.
- **Upgrade path:** HRSA's API needs registration ([data.hrsa.gov](https://data.hrsa.gov/data/download)). The CSV is fine.
- **Gap:** not an agent finder tool (only snapshot rows for CA). Add it to the `health` finder.

### Snapshot sources (`scripts/build_snapshot.py`)

| Source | Covers | Limits | Other states | Could be live? |
|---|---|---|---|---|
| CDCR DAPO Community Resource Guides (PDF) | Parole-oriented local programs, North and South regions | PDF parsing; yearly refresh; CA only | Each state DOC differs. Indiana has no current official IDOC guide that I found: the [Notre Dame Indiana Reentry Guide](https://socialconcerns.nd.edu/wp-content/uploads/2025/03/Indiana-Reentry-Guide_online-version.pdf) (2025) is the closest, and IDOC has facility re-entry coordinators ([policy](https://in.gov/idoc/files/policy-and-procedure/policies/01-07-101-case-mgmt/10-Pre-Release-9-11-2023.pdf)). Montana has [prerelease centers](https://cor.mt.gov/Facilities/PrereleaseCenters) and a 2025 Office of Reentry in the Dept. of Labor and Industry (per the [Reentry Report 2026](https://lmi.mt.gov/_docs/Publications/LMI-Pubs/Special-Reports-and-Studies/Reentry-Report-2026.pdf); I couldn't extract the PDF text, so details are **unverified**) | No |
| CareerOneStop reentry provider XLSX | Reentry employment providers | Bulk file; refresh frequency unknown | National file; filter by state | Yes: the ReEntry Program Finder API above |
| HRSA sites CSV | Health centers | — | National | Already national in `build.js` |
| Hand-checked state and county pages (GetCalFresh, BenefitsCal, DHCS Medi-Cal, county GA/GR pages, CalJOBS, EDD AJCC locator, CAL-ID, DMV, LifeLine) | The "how to apply" anchor for each benefit | Hand-maintained; CA only. GetCalFresh now says you **can't apply on it** and points to BenefitsCal ([about page](https://www.getcalfresh.org/en/about/)); check the snapshot copy says the same | Equivalents: FNS state directory entries give each state's SNAP site and hotline. Indiana: hotline 800-403-0864 ([FNS IN](https://www.fns.usda.gov/snap-directory-entry/indiana)). Montana: 888-706-1535 ([FNS MT](https://www.fns.usda.gov/snap-directory-entry/montana)) | Partly: generate from FNS and CMS directories |
| TLM portal resource bank | TLM network programs | Internal; CA-focused | Ask TLM whether Indiana and Montana partners exist | No |
| USAspending.gov reentry grantees | New Second Chance Act programs | Recipients are often agencies | Change the `state` filter | Yes, keyless POST ([docs](https://api.usaspending.gov/)) |

### Linked but not pulled

- **211.org:** see above. In Indiana the state runs 211 (FSSA): online search at in211.org, phone 866-211-9966 ([Indiana 211](https://www.in.gov/fssa/thehub/indiana-211/)). I found no public API.
- **SAMHSA:** already pulled through FindTreatment.gov.
- **LSC (legal aid):** LSC funds 130 legal aid programs in every state ([grantees](https://www.lsc.gov/our-impact/publications/annual-reports/2023-annual-report/lsc-grantees)) and publishes a [service-area map](https://lsc.gov/grants/basic-field-grant/lsc-service-areas/map-lsc-service-areas). I found no API or bulk file (**unverified**). A hand-checked "legal aid by state" rule entry is enough.
- **lifelinesupport.org:** has a [Companies Near Me](https://www.lifelinesupport.org/?p=7082) lookup. USAC's open data has disbursements, but I found no provider list ([USAC program data](https://www.usac.org/lifeline/learn/program-data/)). Keep it as a link.
- **ccresourcecenter.org:** 50-state analyses, including [SNAP/TANF after a drug conviction](https://ccresourcecenter.org/national-snap-tanf-drug-felony-study/). This is the best source for state rules of the `calfresh_drug_felony` kind. Pair it with [NICCC](https://niccc.nationalreentryresourcecenter.org) for other collateral consequences.
- **selfhelp.courts.ca.gov:** CA only. Other states have their own court self-help sites.

### The team's CA API catalog (artifact, Nov 5)

It lists 7 sources: FindTreatment, HUD counselors, FDIC, USAspending (live, no key); CareerOneStop and HRSA (free key); and 211 NDP (partner). Its notes match what I found, with three additions:
- Every "no key" source in it also works in Montana and Indiana.
- HRSA no longer needs a key for our use, because the CSV is already split by state in `build.js`.
- CareerOneStop has the ReEntry Program Finder API as well as the AJC finder.

## Task 2: new sources

### 1. Benefits eligibility and office APIs (most important)

**SNAP.** Federal rules are the same everywhere except BBCE (state gross limit and asset test) and the drug-felony option. Those three facts plus the FNS tables are enough for a "likely / worth applying" call.
- **FNS COLA page** ([link](https://www.fns.usda.gov/snap/allotment/cola); fns.usda.gov returned 403 to WebFetch, and the mirror at fns-prod.azureedge.us served the same page). FY2027, effective Oct 1, 2026 to Sep 30, 2027, for the 48 states and DC:
  - Gross limit (130% FPL): $1,729 for 1 person, $3,575 for 4.
  - Net limit (100% FPL): $1,330 for 1 person, $2,750 for 4.
  - Max allotment: $306 for 1, $562 for 2, $808 for 3, $1,023 for 4.
  - Format: HTML tables plus PDFs. **No machine-readable file.**
- **BBCE state chart** ([June 2026 PDF](https://fns-prod.azureedge.us/sites/default/files/resource-files/BBCE-States-Chart-June2026.pdf)):
  - Montana: 200% FPL gross and no asset limit, per a search summary of the chart. Montana's own manual still describes a $4,500 resource limit ([SNAP304.1](https://www.dphhs.mt.gov/assets/hcsd/snapmanual/SNAP304.1.pdf)). **Unverified; check by hand.**
  - Indiana: 130% FPL gross and a $5,000 asset limit on the Aug 2025 chart ([PDF](https://fns-prod.azureedge.us/sites/default/files/resource-files/snap-bbceStatesChart-aug2025.pdf)). The 2026 figures are **unverified**.
- **Drug-felony rule:** Indiana lifted its lifetime ban in 2020 and conditions SNAP on following probation or parole terms ([CCRC](https://ccresourcecenter.org/national-snap-tanf-drug-felony-study/)). Montana's current rule is **unverified**.
- **Work rules (OBBBA):** the ABAWD time limit now applies through age 64, and exemptions for people who are homeless or are veterans were removed ([FNS implementation](https://fns-prod.azureedge.us/snap/obbb-abawd-exemptions-implementation), [Ballotpedia](https://news.ballotpedia.org/2025/07/16/budget-reconciliation-bill-changes-snap-and-medicaid-work-requirements/)). This matters for single adults just released.
- **Offices:** the FNS state directory entry for each state gives the state SNAP site, hotline, local office list and online application link ([Indiana](https://www.fns.usda.gov/snap-directory-entry/indiana), [Montana](https://www.fns.usda.gov/snap-directory-entry/montana)). It is HTML only.

**Medicaid.**
- **Expansion status:** KFF's tracker lists 41 states including DC as having adopted expansion ([KFF](https://www.kff.org/affordable-care-act/state-indicator/state-activity-around-expanding-medicaid-under-the-affordable-care-act/)). Indiana adopted it in 2015 (HIP). Montana lifted its 2025 sunset ([Daily Montanan](https://dailymontanan.com/?p=32343)).
- **data.medicaid.gov:** has a keyless DKAN API. I tested `GET /api/1/datastore/query/d7e4cccb-.../0`, and it returned 51 rows of MAGI limits by state, but the data is **as of April 2018**. Use it only as a cross-check.
- **Work requirements:** start Jan 1, 2027 under the CMS interim final rule. They exempt people **incarcerated within the last three months** ([AAPD FAQ](https://www.aapd.com/medicaid-work-requirements-faq/), [McDermott+](https://www.mcdermottplus.com/?p=160419)); check the exact wording in the Federal Register.
  - Indiana: HIP work requirements begin Jan 1, 2027 with a 3-month lookback ([Indiana Capital Chronicle](https://indianacapitalchronicle.com/2026/07/07/indiana-fssa-shares-medicaid-work-requirement-rules/)).
  - Montana: planned to start early, July 2026 (**unverified** whether it did).
  - **This should be a stored rule for every state:** "recently released, so exempt for the first 3 months; apply now."
- **Offices:** the [CMS contacts directory](https://www.cms.gov/apps/contacts/) lists state Medicaid offices. I found no API.

**Calculators.**
- **PolicyEngine:**
  - Hosted endpoint: `POST https://household.api.policyengine.org/us/calculate`, using OAuth client credentials requested from hello@policyengine.org ([API page](https://www.policyengine.org/us/api)).
  - Self-host: Docker image `ghcr.io/policyengine/policyengine-household-api`, about 4 GB RAM ([docs](https://policyengine.github.io/policyengine-household-api/)).
  - The rules engine `policyengine-us` is AGPL-3.0 ([GitHub](https://github.com/PolicyEngine/policyengine-us)).
  - The docs show SNAP examples. Medicaid by state is **unverified**, and so is whether drug-felony or work-requirement rules are modeled.
  - **Privacy:** the request needs only age, income, household size and `state_code`. No name, address or conviction. That fits our rule that only public data leaves the Worker. Treat the output as a benefit estimate, never a determination.
- **CMS Marketplace API:** has a "Get eligibility estimates" endpoint covering Medicaid/CHIP. Keys come from a [request form](https://developer.cms.gov/marketplace-api/key-request.html) and expire every 60 days ([docs](https://developer.cms.gov/marketplace-api/)). Cost, inputs and coverage of state-based exchange states are **unverified**.
- **mRelief, Benefit Kitchen and Code for America:** I found no public partner API for mRelief or Benefit Kitchen (**unverified**). GetCalFresh has no public API and is California only ([GetCalFresh about](https://www.getcalfresh.org/en/about/)).

**Can these replace hand-written per-state rules?** Partly.
- **Generated:** income limits, allotments and BBCE thresholds can come from the FNS tables each October, and expansion status from KFF. A `scripts/build_rules.py` would scrape these into `rules_<state>.json` with `source_url` and `as_of`, the same shape as `rules_ca.json`.
- **Hand-checked:** the reentry-specific rules (drug-felony bans, pre-release Medicaid such as CalAIM, ID programs, record clearance) need about 6–8 entries per state, from CCRC, NICCC and state pages.
- **Calculated:** PolicyEngine adds a household SNAP estimate on top; it doesn't replace the written rules the judge must cite.

### 2. Resource directories

| Directory | Access terms | Coverage | Cost | Partner requirement |
|---|---|---|---|---|
| 211 NDP | Trial product (limited data); full access through the API Request Form, which creates an "API product" for the recipient | 240+ 211s, about 2M resources, "96% US coverage" ([portal](https://apiportal.211.org/)) | Free for internal use; 5% of data valuation for revenue-generating use ([FAQ](https://register.211.org/Home/FAQs)) | Yes. 211s own their data; V2 is in preview and some features are 211-only |
| Indiana 211 | Run by FSSA; maintains its own statewide database ([FAQs PDF](https://in.gov/fssa/files/Indiana-211-FAQs.pdf)) | IN | Free | Data-sharing agreement with FSSA (no API found) |
| findhelp | No public developer program found. One insurer portal lists a findhelp integration API with 1,000 calls/hour ([Blue Shield CA](https://devportal-dev.blueshieldca.com/bsc/qa2/product/1992)) | National | Subscription; pricing not published ([G2](https://www.g2.com/products/findhelp/pricing), [GSA](https://www.gsaadvantage.gov/ref_text/47QTCA26D005U/47QTCA26D005U_Findhelp_47QTCA26D005U_MAS_FSSPriceList.pdf)) | Yes (contract) |
| Unite Us | No public API found. Free for nonprofit CBOs to join ([Unite Montana](https://uniteus.com/networks/montana/)) | Unite Montana and Unite Indiana networks | Free for CBOs | Yes (network membership; an API is **unverified**) |
| CareerOneStop | Free registration for userId and token | National | Free | No |

### 3. Reentry sources for other states

- **Indiana:**
  - Notre Dame's [Indiana Reentry Guide](https://socialconcerns.nd.edu/wp-content/uploads/2025/03/Indiana-Reentry-Guide_online-version.pdf) (2025, PDF), the best snapshot seed I found.
  - The [IDOC re-entry programs](https://www.in.gov/idoc/divisions/re-entry/programs) page.
  - Indiana 211.
  - WFYI's Feb 2026 guide to housing with a record ([WFYI](https://www.wfyi.org/news/tags/reentry)).
- **Montana:**
  - DOC [prerelease centers](https://cor.mt.gov/Facilities/PrereleaseCenters): 10 centers run by 5 nonprofits, per the DOC site as summarized by search.
  - The new Office of Reentry (HB 718, 2025) in the Dept. of Labor and Industry, per the [Reentry Report 2026](https://lmi.mt.gov/_docs/Publications/LMI-Pubs/Special-Reports-and-Studies/Reentry-Report-2026.pdf) (**unverified**: I couldn't extract the PDF).
  - 211 Montana: provider and database details are **unverified**.
  - Third-party lists ([probationinfo.org](https://www.probationinfo.org/reentry-resources/montana/)) are compiled by outside groups and may be out of date.
- **National:**
  - The [National Reentry Resource Center](https://nationalreentryresourcecenter.org/) has no state services directory or API on its home page. Its useful assets are NICCC, the Clean Slate Clearinghouse and the Second Chance Act grantee map ([link](https://nationalreentryresourcecenter.org/second-chance-act)).
  - USAspending finds the same grantees by state.

## Task 3: Exa feasibility

### What Exa offers

**Search: `POST https://api.exa.ai/search`** ([docs](https://docs.exa.ai/reference/search))
- **Auth:** `x-api-key` or `Authorization: Bearer`.
- **Types:** `auto`, `lite` and `deep` (legacy `instant`/`fast`). Up to 100 results per call.
- **Domain filters:** `includeDomains` and `excludeDomains`, each up to 1,200 entries, with path prefixes and `*.` wildcards.
- **Date filters:** `startPublishedDate` and `endPublishedDate`. The crawl-date filters are deprecated.
- **Categories:** `company`, `publication`, `news`, `personal site`, `financial report`, `people`. None of them fits social services.
- **Location:** `userLocation`, a country or lat/lon.
- **Inline contents:** `text`, `highlights` and `summary` (with a JSON schema).
- **Freshness:** `maxAgeHours` (0 means fetched live within the last 60 seconds).

**Contents: `POST https://api.exa.ai/contents`** ([docs](https://docs.exa.ai/reference/get-contents))
- Takes up to 100 URLs.
- Returns text (with `maxCharacters`), highlights or summary.
- Supports `maxAgeHours` and subpage crawling.

**Rate limits** ([docs](https://docs.exa.ai/reference/rate-limits)): 10 QPS for `/search` (5 for deep) and 100 QPS for `/contents`, per team, with a 429 and `Retry-After` when exceeded.

**Pricing** ([pricing](https://exa.ai/pricing)):
- `auto`/`fast`: $7 per 1k requests. `lite`/`instant`: $4 per 1k. Up to 10 results are included.
- Contents: $1 per 1k pages per content type.
- Free tier: $10 a month, reset monthly, no card needed. No nonprofit program is listed.

**Privacy:** zero data retention is an Enterprise option ([security](https://docs.exa.ai/reference/security-soc-2), [ZDR blog](https://exa.ai/blog/zdr-search-engine)). Exa is SOC 2 Type II. Default retention and whether queries are used for training aren't stated on the docs page (**unverified**). Our queries contain only places and program words, so the risk is low, but it is still one more processor.

**Workers:** it's a plain JSON POST, so `fetch` works with no SDK. Cloudflare also launched a **Web Search API (beta, Oct 2, 2026)** with Exa as a provider: `env.AI.websearch({ gatewayId, query, provider, limit })`, billed at the provider's list price. The changelog says all providers support ZDR through Cloudflare ([changelog](https://developers.cloudflare.com/changelog/post/2026-10-02-introducing-web-search-api/)), but a third-party write-up says the providers table lists Exa as "No" ([braindetox](https://braindetox.kr/en/posts/cloudflare_web_search_api_ai_agents_beta_2026.html)): **unverified**. The binding doesn't document domain or date filters, so call Exa directly if we need them.

### What we do today

- Each finder gets Claude's server-side `web_search_20260209` with `max_uses: 6`, plus `web_fetch` with 3 uses. The judge gets 2 searches and 1 fetch.
- `user_location` is pinned to California (`agent.ts:26-33`, `stages.ts:181,222`).
- Measured in `evals/matrix-report.md` for opus-sonnet:
  - **22.7 web searches and 2.7 fetches per plan** over 18 API calls.
  - **$0.227 per plan on search fees**, out of $1.83 per plan uncached.
  - Finders account for $1.41 and **519K input tokens**.

Claude's search costs **$10 per 1k searches** plus result tokens. It supports `allowed_domains`/`blocked_domains`, `user_location` and `max_uses`, and with `20260209` it adds dynamic filtering in code execution so less text reaches the context. It has no date filter ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)). Searches run inside one Messages call, with no extra round trip per search.

### Cost at our volume

| | Per search | Per 1,000 searches | Per plan (23 searches) | 1,000 plans/month (1,000 returners, monthly runs) |
|---|---|---|---|---|
| Claude web_search | $0.010 + tokens | $10 | $0.23 | $230 |
| Exa `auto`, 10 results + highlights | $0.007 + 10 × $0.001 = $0.017 | $17 | $0.39 | $390 |
| Exa `lite`, 5 results + highlights | $0.004 + $0.005 = $0.009 | $9 | $0.21 | $210 |

The token side is what decides it, and it can go either way:
- **For Exa:** a highlights cap (for example 1,500 characters per result) could shrink the 519K finder input.
- **Against Exa:** as a *client* tool, each Exa search ends the Claude turn, and the whole conversation is re-sent on the next call. Five finders × 4–6 searches adds about 20–30 extra Sonnet calls per plan, which doubles the 25–50 call budget. Without prompt caching (the matrix shows 0 cache reads), that likely costs more than it saves, and it adds latency when runs already average 92.9 s against a 90 s target (`evals/report.md`).

### How it would plug in (sketch, not applied)

In `site/functions/_agent/tools.ts`:

```ts
// Exa web search (optional). Only search words and a place are sent: no profile fields.
export async function exaSearch(env: any, query: string, opts: {
  includeDomains?: string[]; excludeDomains?: string[]; sinceDays?: number; num?: number; lat?: number; lon?: number;
} = {}): Promise<any> {
  if (!env.EXA_API_KEY) return { error: "EXA_API_KEY not configured; use web_search instead" };
  const body: any = {
    query, type: "auto", numResults: Math.min(opts.num ?? 8, 10),
    userLocation: opts.lat != null ? { country: "US", latitude: opts.lat, longitude: opts.lon } : "US",
    contents: { highlights: { query, maxCharacters: 1500 }, maxAgeHours: 720 },
  };
  if (opts.includeDomains?.length) body.includeDomains = opts.includeDomains;
  if (opts.excludeDomains?.length) body.excludeDomains = opts.excludeDomains;
  if (opts.sinceDays) body.startPublishedDate = new Date(Date.now() - opts.sinceDays * 864e5).toISOString();
  try {
    const d = await getJson("https://api.exa.ai/search", {
      method: "POST", headers: { "x-api-key": env.EXA_API_KEY, "content-type": "application/json" }, body: JSON.stringify(body),
    }, 20000);
    return (d.results || []).map((r: any) => ({
      title: r.title, url: r.url, published: r.publishedDate, highlights: r.highlights, source: "exa", source_url: r.url,
    }));
  } catch (e: any) {
    return { error: `Exa search failed: ${e.message}` };
  }
}
```

In `stages.ts` `finderTools()`, behind a flag so the A/B test can switch backends:

```ts
if (ctx.env.EXA_API_KEY && ctx.env.SEARCH_BACKEND !== "claude") tools.push({
  name: "exa_search",
  description: "Web search for local programs. Use include_domains for official sites (e.g. .gov, the county site) and since_days for recent pages.",
  input_schema: { type: "object", properties: {
    query: S("e.g. 'sober living men Bakersfield accepts parolees'"),
    include_domains: { type: "array", items: S() }, exclude_domains: { type: "array", items: S() },
    since_days: { type: "integer" } }, required: ["query"] },
  fn: (i: any) => exaSearch(ctx.env, i.query, { includeDomains: i.include_domains, excludeDomains: i.exclude_domains,
    sinceDays: i.since_days, lat: p.lat, lon: p.lon }),
  label: (i: any) => `Exa search: ${i.query}`,
});
// and pass serverTools: SEARCH_BACKEND === "exa" ? webTools(...).filter(t => t.name === "web_fetch") : webTools(...)
```

- **Secret:** `wrangler pages secret put EXA_API_KEY`.
- **Exa results:** need no special handling for "traceable source", because the `url` becomes `source_url`.
- **Evals:** they run the **Python** pipeline (`app/`), so the same tool has to be added to `app/tools/apis.py` and `app/pipeline.py` for the test.

### A/B test design

1. **Profiles.** All 18 in `evals/profiles.json`, plus rural profiles. Today none is truly rural; Bakersfield is the closest. Add:
   - `dale-susanville`: Lassen County, a prison town far from services.
   - `carla-crescent-city`: Del Norte County, a coastal county with few providers.
   - After integration #2 below, `jim-missoula-mt` and `ann-terre-haute-in`, with expected entries hand-written from FNS, KFF and the state guides.
2. **Arms.**
   - **A:** today (`web_search` with 6 uses).
   - **B:** `exa_search` instead of `web_search` (same 6-use cap enforced in the tool; `web_fetch` kept).
   - **C (optional):** both offered.
   - Run each arm with `evals/run_evals.py --out-dir evals/runs/exa-<arm> --no-latest`, using `SEARCH_BACKEND` set the way `run_matrix.py` sets model env vars. Run 2 repeats per arm, because runs are noisy.
3. **Metrics** (already in `summary.json`): must-include recall, gray kept, wrong exclusions, must-not violations, invented, working links, seconds per run, $ per plan (with search fees from `pricing.py`; add an Exa line).
4. **New metrics to add:**
   - API calls per plan.
   - Finder input tokens.
   - Share of recommendations on `.gov` or the program's own domain.
   - Share of recommendations in the person's county (rural profiles).
   - Distinct programs not found in the snapshot.
   - Median page age of cited sources.
5. **Decision rule.** Adopt B only if, on the rural and out-of-state profiles, it raises recall or in-county share by at least 10 points, with no loss in links or must-not, and keeps $/plan and seconds within 10% of A.
6. **Cost of the test.** About 22 profiles × 2 repeats × 23 searches ≈ 1,000 Exa searches ≈ $17 at `auto` with highlights. The free $10 a month covers about 580 searches, so it would need a small top-up or two months. That needs a sign-up, which is the team's call.

### Verdict: **No** (don't add Exa now)

1. **It fixes no measured problem.** Recall is 99% and invented results are 0. The failing metrics are links (88%), must-not (6) and speed (92.9 s). Exa doesn't address the first two, and it hurts speed through the extra client round trips.
2. **It costs more.** $7–17 per 1k searches against $10, plus about 20–30 extra Claude calls per plan.
3. **Most of its filters we already have.** `allowed_domains`/`blocked_domains` and `user_location` exist on Claude's tool. Exa's real additions are published-date filters and `maxAgeHours`, which are nice but not a priority.
4. **It adds a vendor, a key and a retention question.** ZDR needs Enterprise, or Cloudflare's beta binding, whose ZDR status is unclear.
5. **The real gap for Indiana and Montana is our CA-only code and data, not the search engine.**

Revisit Exa if the rural and out-of-state evals (after integration #2) show low recall or many out-of-county results. The test above is ready for that case.

## Next 3 integrations to build

1. **Multi-state benefits rules for SNAP and Medicaid (M).** Write `scripts/build_rules.py`, which generates `rules_<state>.json` from:
   - the FNS FY2027 tables, the BBCE chart and the state directory entries;
   - KFF expansion status and the CMS contacts;
   - 6–8 hand-checked reentry rules per state from CCRC and NICCC: drug-felony SNAP rule, the Medicaid recently-incarcerated exemption, ID program, record clearance.

   Start with Indiana and Montana, and **refresh the stale CA CalFresh figures** (FY2027: $306 max for 1 person). Make `lookup_rule` take the state. *Why:* this is the top priority, free, no partner needed, and it keeps the judge citing written rules.
2. **Make the pipeline state-agnostic and add the national live tools to the finders (S–M):**
   - Pass the state into `geocode`, the FDIC filter and `webTools` `user_location`.
   - Remove "California" from the prompts and use county adjacency from Census data instead of `NEIGHBORS`.
   - Add the SSA, PHA and HRSA tools from `live.js` to the finders.
   - Set the free CareerOneStop token and add the ReEntry Program Finder API.
   - Seed small IN and MT snapshots from the guides above.

   *Why:* every one of these sources already returned Montana and Indiana data, so case managers there get real results right away. The only cost is a free registration.
3. **PolicyEngine household estimate as a judge tool (M).** Email PolicyEngine for API credentials (they're the partner). Add `estimate_snap` to the food & benefits judge, sending only `{state, household_size, ages, monthly_income}`. *Why:* it gives "about $X a month in SNAP" in any state with no hand-written formulas and no personal data leaving. Self-hosting is the fallback if credentials aren't granted, but it doesn't fit Workers (4 GB RAM).

In parallel, because the lead time is long, **file the 211 API Request Form** (through 211 LA or Indiana 211) so a V2 data product can follow later.

## Open questions for the team

1. Are Indiana and Montana the first states to add, and do TLM partners or alumni exist there to check results with?
2. May we register for the free CareerOneStop token and request PolicyEngine credentials? Both are free but need a person's name and email.
3. Should we file 211's API Request Form now, and through which 211? Would a free internal tool count as "revenue-generating" under the 5% fee?
4. Should benefit estimates (dollar amounts) be shown to case managers at all, or only "likely / worth applying"? Estimates change with work rules from Jan 2027.
5. Who owns the yearly rules refresh each October, when FNS publishes new SNAP figures? `rules_ca.json` is already a year behind.
6. Do we want a published-date limit on web results, which is the main thing Exa would add? If yes, test that first by asking finders to check `page_age`, which Claude's results already include.
7. Do case managers in Indiana and Montana use Unite Us or findhelp already? If so, a partner integration may matter more than any public API.
