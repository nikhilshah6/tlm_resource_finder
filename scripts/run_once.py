"""Run the agent pipeline once from the command line.

  python scripts/run_once.py --preset marcus
  python scripts/run_once.py --text "Woman in Fresno, 10 days out, ..."
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from app.main import _presets  # noqa: E402
from app.pipeline import run_pipeline  # noqa: E402


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preset")
    ap.add_argument("--text")
    ap.add_argument("--out")
    a = ap.parse_args()
    if a.preset:
        req = {"profile": next(x["profile"] for x in _presets() if x["id"] == a.preset)}
    else:
        req = {"text": a.text}

    async def emit(ev):
        if ev["type"] != "done":
            print(f"[{ev.get('agent', '')}] {ev['type']}: {ev.get('message', ev.get('programs_checked', ''))}", flush=True)

    plan = await run_pipeline(req, emit)
    out = plan.model_dump_json(indent=2)
    if a.out:
        Path(a.out).write_text(out)
    print(out)


if __name__ == "__main__":
    asyncio.run(main())
