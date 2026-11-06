# Evals worth tracking (and which to show at the panel)

## Measured today (automated, `evals/run_evals.py` and `evals/run_matrix.py`)

| What | Why it matters to TLM | How it's measured |
|---|---|---|
| **Invented programs** | A case manager must never call a program that doesn't exist | Every recommendation needs a source URL seen during the run; target 0 |
| **Gray areas kept** | Alumni shouldn't miss help because a rule is unclear | Programs labelled "worth applying" in `expected.json` must survive; target 100% |
| **Wrong exclusions** | Saying "not eligible" without a written rule costs someone a benefit | Opus grader checks every exclusion against its cited rule; target 0 |
| **Must-include recall** | The plan covers the needs a specialist would expect | Category and keyword groups per profile; target ≥85% |
| **Must-not violations** | Safety: county restrictions, registrant housing bans | Deterministic checks plus the grader; target 0 |
| **Working links** | A dead link wastes a call | HTTP check of every recommended URL |
| **Reentry-specific share** | Programs that serve people with records, not generic listings | Share of recommendations mentioning reentry, parole/probation, records |
| **Alumni-step readability** | Steps go to the alumnus; plain language matters | Flesch–Kincaid grade of each `for_alumnus` step |
| **Voice leaks in alumni steps** | Alumni shouldn't read staff notes about themselves | Third-person ("his") and staff-only words (eligibility verdicts) in `for_alumnus` |
| **Schema repairs** | How often a model breaks the agent contract (reliability) | Out-of-schema values the pipeline had to map or drop |
| **Cost per plan** | What it costs per alumnus, and at TLM's scale | Tokens × published prices, plus web searches, per agent and role |
| **Seconds per plan** | Whether it fits into a call-prep window | p50 / p90 / max wall time |

Briefing accuracy (Owen's first test run, cc-basecamp-ptype): 225 briefing lines across 18 alumni, 13 of 14 planted record traps caught, 2 lines flagged by the automatic number check (one real error, one false positive), 0 lines without a source.

## Add next (cheap to automate)

1. **Consistency:** run each profile twice; overlap of top picks (Jaccard) and same "act today" order. Shows the plan isn't a coin flip.
2. **Briefing accuracy at scale:** score every generated briefing for cited-source validity, numbers that match their source, and hallucinations per briefing (PRD target 0), plus the "flag as wrong" rate.
3. **Call notes → record precision:** share of proposed field changes whose evidence quote is in the pasted notes; changes auto-unchecked.
4. **Case-manager edit distance:** how much specialists reword AI steps before sharing, and how many they drop (signals trust and quality).
5. **Coverage equity:** recall and recommendation counts for rural vs urban counties (Kern, Fresno vs LA, SF).
6. **Time saved:** a manual baseline (specialist researching the same profile) vs ~90 seconds; today we only estimate (searches × 3 minutes).

## Needs real use (after privacy sign-off)

- Recommendation acceptance rate (recommended → shared → "I used this").
- Time from release to benefits enrolled, ID obtained, housed, employed.
- Contacts per specialist per week; caseload size each specialist can hold.
- Briefing "flag as wrong" lines per 100 briefings, trending down.

## For the 10-minute panel (suggested)

Lead with three trust numbers, one value number, and one honest gap:
- **0 invented programs, 0 wrong exclusions, 100% of gray areas kept** (the guardrails hold).
- **Cost per plan and seconds per plan** for the chosen model mix, with the TLM-scale monthly projection.
- **Gap:** link health and must-not checks show where a human still reviews; nothing reaches an alumnus without the case manager's review.
