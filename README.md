> **Moved:** this repo now lives on GitLab at https://gitlab.com/t9e/development/tlm-reentry-hub (since Nov 13, 2026). This GitHub copy is archived and read-only.

# tlm_resource_finder

The Last Mile reentry hub prototype: a case manager portal with pre-call briefings, call notes, a caseload view, and an agentic resource search that builds an eligibility-checked plan for each (fictional) alumnus. Alumni see what their case manager shares.

Live prototype: https://tlm-reentry-agents.pages.dev (password required). Sample data only.

## What's here

| Path | What |
|---|---|
| `demo/` | The hub UI: `index.html`, `app.js` (views), `core.js` (logic with no UI), `app.css` (every token and style) |
| `reentry-data.js` | 18 fictional alumni, 3 case managers, standard First 30 Days tasks |
| `site/` | The Cloudflare Pages project: `build.js`, the password gate (`functions/_middleware.js`), the Claude proxy (`functions/api/claude.js`), resources (`functions/api/resources.js`, `lib/`) and the **agent pipeline** (`functions/_agent/`, `functions/api/agent/step.ts`) |
| `site/data/agent/` | Per-county California snapshot and eligibility rules the agents search, plus saved demo plans (`demo-plans/`) |
| `app/` | Python reference version of the agent pipeline (FastAPI), used by the evals |
| `data/` | `snapshot_ca.json` (4,819 records) and `rules_ca.json` (12 sourced rules) |
| `scripts/` | `build_snapshot.py` (rebuild `data/` from public sources), `build_agent_data.py` (split it into `site/data/agent/`), `run_once.py` (one Python run from the CLI) |
| `evals/` | 18 fictional profiles, expected results, `run_evals.py` |
| `tests/` | `demo-smoke.js` (end-to-end UI, jsdom), `password-gate.mjs`, `shim-test.js`, `navigator-unit.mjs`, `test_apis.py` |
| `design.md` | How every screen looks and behaves, and the rules for changing it |
| `CLAUDE.md` | Project brief, decisions and guardrails |

## The agent pipeline

| Agent | Model | Job |
| --- | --- | --- |
| Intake | Sonnet 5.5 | Structured profile from the record, geocoded |
| Orchestrator | Opus 5.5 | Orders needs by urgency, briefs each finder |
| 5 finders (housing, health, food & benefits, jobs, legal/ID/money) | Sonnet 5.5 | Search the snapshot, live APIs and the web in parallel |
| Eligibility judge | Opus 5.5 | One verdict per program: likely, worth applying (with the question to ask), or not eligible (only with a written rule) |
| Ranker | Opus 5.5 | Top 2-3 per need, and 1-3 steps for today, each written for the case manager and for the alumnus (`for_alumnus`) |

Each stage is one `POST /api/agent/step` call; the browser chains them (`RXV.agentRun` in `demo/app.js`), so no call exceeds Cloudflare's per-request limits. Gray areas are recommended as "worth applying"; missing information is never a reason to exclude. Nothing AI-written reaches an alumnus until the case manager reviews and shares it.

## Run it locally

```bash
cd site && npm install
node build.js
printf 'ANTHROPIC_API_KEY=...\nSITE_PASSWORD=...\n' > .dev.vars   # gitignored
npx wrangler pages dev public
```

Open http://localhost:8788; the browser asks for the password (any username).

## Deploy

```bash
cd site && npm run deploy
```

This builds and deploys to the `tlm-reentry-agents` Pages project. Its secrets are `ANTHROPIC_API_KEY` and either `SITE_PASSWORD` (any username) or `DEMO_USER` + `DEMO_PASSWORD`. Optional: `CAREERONESTOP_USER_ID` / `CAREERONESTOP_TOKEN` for job-centre lookups.

## Rebuild the data

```bash
python3 scripts/build_snapshot.py --refresh   # downloads public sources into data/
python3 scripts/build_agent_data.py           # writes site/data/agent/snapshot/*.json and rules_ca.json
```

The saved demo plans in `site/data/agent/demo-plans/` (Marcus, Anthony) come from live runs. The search itself always starts from **Build plan**; a saved run loads from **Use saved run** when a live run fails, or on every case with `?saved` in the URL. Re-record them after changing the agents (run the search, then save `RXV.agent[id].plan`).

## Tests

```bash
cd site && node build.js && cd ..
NODE_PATH=<folder with jsdom>/node_modules node tests/demo-smoke.js
node tests/password-gate.mjs
node tests/navigator-unit.mjs
node tests/act-today-unit.mjs                   # Act today post-processing and search focus (needs site/node_modules for esbuild)
.venv/bin/python -m pytest tests/test_act_today.py
.venv/bin/python -m pytest tests/test_apis.py   # live public APIs
.venv/bin/python evals/run_evals.py --presets   # Python pipeline evals (uses the API)
```

## History

The hub UI started in `nikhilshah6/cc-basecamp-ptype` (Owen Duffy and Nikhil Shah) and moved here on Nov 6, 2026; that repo keeps the original claude.ai artifact files. The agents-only Cloudflare UI that used to live in `cf/` is replaced by the hub.
