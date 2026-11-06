"""Claude API prices for the eval matrix, from platform.claude.com/docs/en/about-claude/pricing (read Nov 6, 2026).

USD per million tokens. Cache writes here are the 5-minute TTL rate (the pipeline doesn't set a 1-hour TTL).
Web search is $10 per 1,000 searches plus tokens; web fetch is tokens only.
"""
from __future__ import annotations

WEB_SEARCH_PER_REQUEST = 10.0 / 1000

# model: (input, cache_write_5m, cache_read, output)
PRICES = {
    "claude-fable-5-1": (10.0, 12.50, 0.25, 50.0),
    "claude-opus-5-5": (4.0, 5.0, 0.20, 20.0),
    "claude-sonnet-5-5": (2.0, 2.50, 0.10, 10.0),
    "claude-haiku-5-5": (0.10, 0.125, 0.01, 0.50),
}
# Haiku 5.5 charges more when one request's prompt is over 100K tokens.
HAIKU_LONG = (0.50, 0.625, 0.05, 2.50)
HAIKU_LONG_THRESHOLD = 100_000


def call_cost(c: dict) -> dict:
    """Cost of one API call record (from app.agents.base.record_usage), split by kind."""
    model = c.get("served_model") or c["model"]
    if model not in PRICES:
        model = c["model"]
    rate = PRICES.get(model)
    if rate is None:
        raise KeyError(f"no price for {model}")
    prompt = c["input_tokens"] + c["cache_creation_input_tokens"] + c["cache_read_input_tokens"]
    if model == "claude-haiku-5-5" and prompt > HAIKU_LONG_THRESHOLD:
        rate = HAIKU_LONG
    inp, cw, cr, out = rate
    parts = {
        "input": c["input_tokens"] * inp / 1e6,
        "cache_write": c["cache_creation_input_tokens"] * cw / 1e6,
        "cache_read": c["cache_read_input_tokens"] * cr / 1e6,
        "output": c["output_tokens"] * out / 1e6,
        "web_search": c.get("web_search_requests", 0) * WEB_SEARCH_PER_REQUEST,
    }
    parts["total"] = sum(parts.values())
    return parts


LEAD_AGENTS = {"orchestrator", "eligibility", "ranker"}


def role_of(agent: str) -> str:
    return "lead" if agent in LEAD_AGENTS else "worker"


def summarize(calls: list[dict]) -> dict:
    """Tokens and dollars for one plan: totals, by kind, by role and by agent."""
    tot = {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
           "web_search_requests": 0, "web_fetch_requests": 0}
    cost = {"input": 0.0, "cache_write": 0.0, "cache_read": 0.0, "output": 0.0, "web_search": 0.0, "total": 0.0}
    by_role: dict = {}
    by_agent: dict = {}
    mismatched = 0
    legacy = 0
    for c in calls:
        cc = call_cost(c)
        tot["calls"] += 1
        for k in tot:
            if k != "calls":
                tot[k] += c.get(k, 0) or 0
        for k in cost:
            cost[k] += cc[k]
        agent = c["agent"].split(":")[0] if ":" in c["agent"] else c["agent"]
        agent = "finders" if agent not in ("intake", "orchestrator", "eligibility", "ranker") else agent
        for key, bucket in ((role_of(agent), by_role), (agent, by_agent)):
            b = bucket.setdefault(key, {"usd": 0.0, "input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 0, "web_search_requests": 0, "calls": 0})
            b["usd"] += cc["total"]
            b["input_tokens"] += c["input_tokens"] + c["cache_creation_input_tokens"]
            b["output_tokens"] += c["output_tokens"]
            b["cache_read_input_tokens"] += c["cache_read_input_tokens"]
            b["web_search_requests"] += c.get("web_search_requests", 0)
            b["calls"] += 1
        if c.get("served_model") and c["served_model"] != c["model"]:
            mismatched += 1
        if c.get("web_tools") == "legacy":
            legacy += 1
    return {"tokens": tot, "usd": cost, "by_role": by_role, "by_agent": by_agent, "served_model_mismatches": mismatched, "legacy_web_tool_calls": legacy}
