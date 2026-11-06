# tlm_resource_finder

Agentic search for reentry resources. A team of Claude agents researches California reentry resources for one (fictional) alumnus at a time, so The Last Mile's case managers spend their time on the relationship, not the search.

Live prototype: https://tlm-reentry-agents.pages.dev (sign-in required).

## How it works

| Agent | Model | Job |
| --- | --- | --- |
| Intake | Sonnet 5.5 | Preset or free text to a structured profile, geocoded |
| Orchestrator | Opus 5.5 | Orders needs by urgency, briefs each finder |
| 5 finders (housing, health, food & benefits, jobs, legal/ID/money) | Sonnet 5.5 | Search the snapshot, live APIs and the web in parallel |
| Eligibility judge | Opus 5.5 | One verdict per program: likely, worth applying (with the question to ask), or not eligible (only with a written rule) |
| Ranker | Opus 5.5 | Top 2-3 per need and 1-3 steps to act on today |

Gray-area policy: when eligibility is uncertain, the program is recommended as "worth applying"; missing information is never a reason to exclude. In-person programs outside a parolee's or probationer's restricted county are excluded in code.

**Sources:** a California snapshot (`data/snapshot_ca.json`, 4,819 records from CDCR parole resource guides, HRSA health centers, CareerOneStop reentry programs, state and county essentials, TLM network programs and Second Chance grantees), `data/rules_ca.json` (12 sourced eligibility rules), live APIs (FindTreatment.gov, HUD housing counselors, FDIC BankFind; CareerOneStop and 211 when keys are set) and live web search/fetch.

**Privacy:** fictional profiles only. Only public resource data (city, coordinates, search words) goes to outside APIs.

## Layout

| Path | What |
| --- | --- |
| `app/` | Python reference version: FastAPI server, agent pipeline, API tools, UI in `app/static/` |
| `cf/` | Cloudflare Pages version: TypeScript Pages Functions (`cf/functions/`), browser step runner (`cf/stepwise.js`) |
| `data/` | California snapshot and rules |
| `evals/` | 18 fictional profiles, expected results, `run_evals.py` scorer |
| `scripts/` | `build_snapshot.py` (rebuild data), `build_cf_assets.py` (build `cf/public/`), `run_once.py` (CLI run) |

## Run the Python version locally

```bash
uv venv --python 3.12 .venv && uv pip install -r requirements.txt --python .venv/bin/python
cp .env.example .env   # add ANTHROPIC_API_KEY
.venv/bin/uvicorn app.main:app --port 7860
```

Open http://localhost:7860 (add `?mock=1` for the offline demo replay).

## Deploy to Cloudflare Pages

```bash
python3 scripts/build_cf_assets.py
cd cf && npm install --legacy-peer-deps
npx wrangler login
npx wrangler pages deploy public --project-name tlm-reentry-agents --branch main
```

Set `ANTHROPIC_API_KEY`, `DEMO_USER` and `DEMO_PASSWORD` as Pages secrets (`npx wrangler pages secret put NAME --project-name tlm-reentry-agents`), then redeploy. For local Cloudflare testing, put the same names in `cf/.dev.vars` and run `npx wrangler pages dev public`.

Each agent runs as its own `/api/step` function call and the browser chains them, so no single call exceeds Cloudflare's per-request limits.

## Evals

```bash
.venv/bin/python evals/run_evals.py --presets   # 4 demo profiles
.venv/bin/python evals/run_evals.py             # all 18
```

Last full run (Nov 5, 2026, before the final fixes): 99% must-include recall, 100% gray areas kept, 0 wrong exclusions, 0 invented programs, 88% working links, 93 s average per run.
