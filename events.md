# Live activity events (server-sent events)

`POST /api/run` with JSON `{"preset_id": "..."}` or `{"text": "free-text situation"}` returns
`text/event-stream`. Each SSE message has `event: message` and `data:` = one JSON object:

```json
{"type": "agent_start", "agent": "housing", "message": "Searching housing in Alameda County", "count": null}
```

| type | when | fields used |
| --- | --- | --- |
| `agent_start` | an agent begins | agent, message |
| `tool_call` | an agent calls an API or web search/fetch | agent, message (e.g. "HUD housing counselors near Oakland"), tool |
| `found` | an agent finishes with candidates | agent, message, count |
| `verdict` | eligibility judge finishes | agent="eligibility", message, count (number judged) |
| `stats` | running counters update | programs_checked, sources_searched |
| `error` | a tool or agent failed (run continues) | agent, message |
| `done` | final plan ready | plan (the full `Plan` JSON from app/schemas.py) |

Agent names: `intake`, `orchestrator`, `housing`, `health`, `food_benefits`, `jobs`, `legal_id`,
`eligibility`, `ranker`.

`GET /api/presets` returns `[{"id": "...", "label": "Marcus, 25 days out, Oakland", "summary": "..."}]`.
