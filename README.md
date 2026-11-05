---
title: Reentry Resource Agents
emoji: 🧭
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
short_description: AI agents find California reentry resources for case managers
---

# Reentry Resource Agents (prototype)

A team of Claude agents researches California reentry resources for one (fictional) alumnus at a time, so The Last Mile's case managers spend their time on the relationship, not the search.

- **Agents:** intake, orchestrator (Opus), five parallel finders (Sonnet: housing, health, food & benefits, jobs, legal/ID/money), eligibility judge (Opus, gray areas lean toward "worth applying"), ranker/planner (Opus).
- **Sources:** a California snapshot (CDCR parole resource guides, CareerOneStop reentry programs, HRSA health centers, state essentials, TLM network, Second Chance grantees) plus live APIs (FindTreatment.gov, HUD housing counselors, FDIC BankFind, optional CareerOneStop and 211) and live web search.
- **Privacy:** fictional profiles only. Only public resource data (city, coordinates, search terms) goes to outside APIs.

## Run locally

```bash
uv venv --python 3.12 .venv && uv pip install -r requirements.txt --python .venv/bin/python
cp .env.example .env   # add ANTHROPIC_API_KEY
.venv/bin/uvicorn app.main:app --port 7860
```

Open http://localhost:7860 (add `?mock=1` for the offline demo replay).

## Evals

```bash
.venv/bin/python evals/run_evals.py --presets      # 4 demo profiles
.venv/bin/python evals/run_evals.py                # all 18
```
