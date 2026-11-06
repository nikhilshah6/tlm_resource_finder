"""A small async agent loop over the Messages API.

Why a manual loop instead of the beta tool runner: every API call, web search and web fetch
is streamed to the live activity feed, and each agent ends by calling a `submit` tool whose
input is its structured result.
"""
from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

import anthropic

# Two roles: the lead (orchestrator, eligibility judge, ranker) and the workers (intake, finders).
# LEAD_MODEL / WORKER_MODEL pick them (the eval matrix sets these); OPUS_MODEL / SONNET_MODEL still work.
LEAD = os.getenv("LEAD_MODEL") or os.getenv("OPUS_MODEL", "claude-opus-5-5")
WORKER = os.getenv("WORKER_MODEL") or os.getenv("SONNET_MODEL", "claude-sonnet-5-5")
OPUS, SONNET = LEAD, WORKER  # older names
USE_FALLBACKS = os.getenv("USE_FALLBACKS", "1") == "1"
# Opt-in prompt caching (off by default). When on, every request gets an explicit 5-minute breakpoint on the
# system prompt (caches tools + system, shared by repeated calls of the same agent) plus top-level automatic
# caching for the growing message history. With caching on, the API also caches server tool results
# (web search / fetch) between the server-side iterations of a single request.
CACHE_PROMPTS = os.getenv("CACHE_PROMPTS", "0") == "1"

Emit = Callable[[dict], Awaitable[None]]

_client: Optional[anthropic.AsyncAnthropic] = None


def client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(max_retries=3, timeout=180)
    return _client


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    fn: Callable[..., Any]  # sync or async; returns JSON-serializable
    label: Callable[[dict], str] = lambda i: ""  # feed text for a call
    counts_as_source: bool = True

    def spec(self) -> dict:
        return {"name": self.name, "description": self.description, "input_schema": self.input_schema}


@dataclass
class Counters:
    programs_checked: int = 0
    sources_searched: int = 0
    seen_urls: set = field(default_factory=set)
    calls: list = field(default_factory=list)  # one usage record per API call (agent, model, tokens, web requests)
    schema_repairs: list = field(default_factory=list)  # out-of-schema values a model returned that the pipeline mapped or dropped


# Models that reject the 20260209 web tools get the earlier versions (found on first use, then remembered).
LEGACY_WEB_TOOLS: set = set()
_LEGACY = {"web_search_20260209": "web_search_20250305", "web_fetch_20260209": "web_fetch_20250910"}


def _tools_for(model: str, tools: list[dict]) -> list[dict]:
    if model not in LEGACY_WEB_TOOLS:
        return tools
    return [dict(t, type=_LEGACY[t["type"]]) if t.get("type") in _LEGACY else t for t in tools]


def record_usage(counters: Counters, agent: str, model: str, resp) -> None:
    u = getattr(resp, "usage", None)
    stu = getattr(u, "server_tool_use", None) if u else None
    counters.calls.append({
        "agent": agent, "model": model, "served_model": getattr(resp, "model", model),
        "input_tokens": getattr(u, "input_tokens", 0) or 0,
        "output_tokens": getattr(u, "output_tokens", 0) or 0,
        "cache_creation_input_tokens": getattr(u, "cache_creation_input_tokens", 0) or 0,
        "cache_read_input_tokens": getattr(u, "cache_read_input_tokens", 0) or 0,
        "web_search_requests": getattr(stu, "web_search_requests", 0) or 0 if stu else 0,
        "web_fetch_requests": getattr(stu, "web_fetch_requests", 0) or 0 if stu else 0,
        "web_tools": "legacy" if model in LEGACY_WEB_TOOLS else "20260209",
    })


def web_tools(city: Optional[str], search_uses: int = 5, fetch_uses: int = 4) -> list[dict]:
    loc = {"type": "approximate", "region": "California", "country": "US", "timezone": "America/Los_Angeles"}
    if city:
        loc["city"] = city
    return [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": search_uses, "user_location": loc},
        {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": fetch_uses},
    ]


async def run_agent(
    *,
    agent: str,
    model: str,
    system: str,
    user: str,
    submit_schema: dict,
    submit_description: str,
    emit: Emit,
    counters: Counters,
    tools: list[Tool] | None = None,
    server_tools: list[dict] | None = None,
    effort: str = "medium",
    max_turns: int = 14,
    max_tokens: int = 32000,
) -> dict:
    """Run one agent until it calls `submit`. Returns the submit input dict."""
    tools = tools or []
    by_name = {t.name: t for t in tools}
    submit = {"name": "submit", "description": submit_description, "input_schema": submit_schema}
    tool_specs = [t.spec() for t in tools] + (server_tools or []) + [submit]
    messages: list[dict] = [{"role": "user", "content": user}]
    nudged = False
    reported: set = set()

    for _turn in range(max_turns):
        resp = await _create(model=model, system=system, messages=messages, tools=tool_specs,
                             effort=effort, max_tokens=max_tokens)
        record_usage(counters, agent, model, resp)
        # Report server-side tool use (web search / fetch) to the feed, once per call.
        for b in resp.content:
            if b.type == "server_tool_use":
                inp = b.input if isinstance(b.input, dict) else {}
                key = (b.name, json.dumps(inp, sort_keys=True))
                if b.id in reported or key in reported or b.name not in ("web_search", "web_fetch"):
                    continue
                reported.update({b.id, key})
                inp = b.input if isinstance(b.input, dict) else {}
                if b.name == "web_search":
                    await emit({"type": "tool_call", "agent": agent, "tool": "web_search",
                                "message": f"Web search: {inp.get('query', '')}"})
                elif b.name == "web_fetch":
                    url = inp.get("url", "")
                    counters.seen_urls.add(url)
                    await emit({"type": "tool_call", "agent": agent, "tool": "web_fetch",
                                "message": f"Reading {url}"})
                counters.sources_searched += 1
            elif b.type == "web_search_tool_result":
                content = b.content if isinstance(b.content, list) else []
                for r in content:
                    u = getattr(r, "url", None)
                    if u:
                        counters.seen_urls.add(u)
                counters.programs_checked += len(content)
        await emit({"type": "stats", "programs_checked": counters.programs_checked,
                    "sources_searched": counters.sources_searched})

        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason == "pause_turn":
            continue
        if resp.stop_reason == "refusal":
            raise RuntimeError(f"{agent} agent declined the request")

        uses = [b for b in resp.content if b.type == "tool_use"]
        if not uses:
            # Ended without submit: try to parse JSON from text, else nudge once.
            text = "".join(getattr(b, "text", "") for b in resp.content if b.type == "text")
            parsed = _json_from_text(text)
            if parsed is not None:
                return _decode_fields(parsed)
            if nudged:
                raise RuntimeError(f"{agent} agent finished without submitting results")
            nudged = True
            messages.append({"role": "user", "content": "Call the submit tool now with your final results."})
            continue

        results = []
        submitted = None
        calls = []
        for u in uses:
            if u.name == "submit":
                submitted = _decode_fields(u.input)
                results.append({"type": "tool_result", "tool_use_id": u.id, "content": "Received."})
            elif u.name in by_name:
                calls.append(u)
            else:
                results.append({"type": "tool_result", "tool_use_id": u.id, "is_error": True,
                                "content": f"Unknown tool {u.name}"})
        outs = await asyncio.gather(*[_call_tool(by_name[u.name], u.input, agent, emit, counters) for u in calls])
        for u, out in zip(calls, outs):
            results.append({"type": "tool_result", "tool_use_id": u.id, "content": out})
        if submitted is not None:
            return submitted
        messages.append({"role": "user", "content": results})

    raise RuntimeError(f"{agent} agent ran out of turns")


async def _call_tool(t: Tool, inp: dict, agent: str, emit: Emit, counters: Counters) -> str:
    label = ""
    try:
        label = t.label(inp)
    except Exception:  # noqa: BLE001
        pass
    if label:
        await emit({"type": "tool_call", "agent": agent, "tool": t.name, "message": label})
    try:
        out = t.fn(**inp)
        if asyncio.iscoroutine(out):
            out = await asyncio.wait_for(out, timeout=20)
    except Exception as e:  # noqa: BLE001
        out = {"error": f"{t.name} failed: {e}"}
    if t.counts_as_source:
        counters.sources_searched += 1
    if isinstance(out, list):
        counters.programs_checked += len(out)
        for r in out:
            if isinstance(r, dict) and r.get("source_url"):
                counters.seen_urls.add(r["source_url"])
    elif isinstance(out, dict) and out.get("error"):
        await emit({"type": "error", "agent": agent, "message": out["error"]})
    return json.dumps(out, default=str)[:60000]


async def _create(*, model, system, messages, tools, effort, max_tokens):
    try:
        return await _create_once(model=model, system=system, messages=messages, tools=tools, effort=effort, max_tokens=max_tokens)
    except anthropic.BadRequestError as e:
        msg = str(e).lower()
        # a model that doesn't take the 20260209 web tools: switch it to the earlier versions and retry once
        if model not in LEGACY_WEB_TOOLS and ("web_search" in msg or "web_fetch" in msg or "20260209" in msg):
            LEGACY_WEB_TOOLS.add(model)
            return await _create_once(model=model, system=system, messages=messages, tools=tools, effort=effort, max_tokens=max_tokens)
        raise


async def _create_once(*, model, system, messages, tools, effort, max_tokens):
    kwargs = dict(
        model=model, max_tokens=max_tokens, system=system, messages=messages, tools=_tools_for(model, tools),
        thinking={"type": "adaptive"}, output_config={"effort": effort},
    )
    if CACHE_PROMPTS:
        kwargs["system"] = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
        kwargs["cache_control"] = {"type": "ephemeral"}  # automatic breakpoint on the last block of messages
    global USE_FALLBACKS
    if USE_FALLBACKS:
        try:
            async with client().beta.messages.stream(
                betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs
            ) as s:
                return await s.get_final_message()
        except anthropic.BadRequestError as e:
            if "fallback" not in str(e).lower():
                raise
            USE_FALLBACKS = False  # this account/model doesn't take fallbacks; continue without
    async with client().messages.stream(**kwargs) as s:
        return await s.get_final_message()


def _decode_fields(inp):
    """Models occasionally send an array/object field as a JSON string; decode it."""
    if not isinstance(inp, dict):
        return inp
    out = {}
    for k, v in inp.items():
        if isinstance(v, str) and v.lstrip()[:1] in ("[", "{"):
            try:
                out[k] = json.loads(v)
                continue
            except json.JSONDecodeError:
                pass
        out[k] = v
    return out


def _json_from_text(text: str) -> Optional[dict]:
    text = text.strip()
    if not text:
        return None
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None
