"""FastAPI app: presets, the streaming agent run, and the static UI."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from sse_starlette.sse import EventSourceResponse  # noqa: E402

from app.pipeline import run_pipeline  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "app" / "static"

app = FastAPI(title="Reentry Resource Agents")

FALLBACK_PRESETS = [
    {"id": "marcus", "label": "Marcus, Oakland, 25 days out",
     "summary": "Staying with his sister until month end, parole with 10pm curfew, wants warehouse work.",
     "profile": {"id": "marcus", "display_name": "Marcus", "city": "Oakland", "county": "Alameda", "zip": "94607",
                 "days_since_release": 25, "supervision": {"type": "parole", "curfew": "10pm-6am", "county_restriction": "Alameda"},
                 "documents_held": ["state_id"], "housing_status": "family_or_friends", "monthly_income": 0,
                 "gender": "man", "goals": ["warehouse supervisor job", "own place by January"], "barriers": ["no car", "must leave sister's place soon"]}},
]


def _presets() -> list[dict]:
    p = ROOT / "evals" / "profiles.json"
    try:
        profiles = json.loads(p.read_text())
        out = [{"id": x["id"], "label": x.get("label") or x.get("display_name"), "summary": x.get("summary", ""),
                "profile": {k: v for k, v in x.items() if k not in ("preset", "label", "summary")}}
               for x in profiles if x.get("preset")]
        if out:
            return out
    except Exception:  # noqa: BLE001
        pass
    return FALLBACK_PRESETS


@app.get("/api/presets")
def presets():
    return [{"id": x["id"], "label": x["label"], "summary": x["summary"]} for x in _presets()]


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/run")
async def run(req: Request):
    body = await req.json()
    if body.get("preset_id"):
        match = next((x for x in _presets() if x["id"] == body["preset_id"]), None)
        if not match:
            return JSONResponse({"error": "unknown preset"}, status_code=404)
        request = {"profile": match["profile"]}
    elif body.get("text", "").strip():
        request = {"text": body["text"].strip()[:4000]}
    else:
        return JSONResponse({"error": "send preset_id or text"}, status_code=400)

    queue: asyncio.Queue = asyncio.Queue()

    async def emit(ev: dict):
        await queue.put(ev)

    async def worker():
        try:
            await run_pipeline(request, emit)
        except Exception as e:  # noqa: BLE001
            await queue.put({"type": "error", "agent": "orchestrator", "message": f"Run failed: {e}"})
            await queue.put({"type": "done", "plan": None})

    task = asyncio.create_task(worker())

    async def stream():
        try:
            while True:
                ev = await queue.get()
                yield {"event": "message", "data": json.dumps(ev, default=str)}
                if ev.get("type") == "done":
                    break
        finally:
            if not task.done():
                task.cancel()

    return EventSourceResponse(stream(), ping=10)


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


app.mount("/", StaticFiles(directory=STATIC), name="static")
