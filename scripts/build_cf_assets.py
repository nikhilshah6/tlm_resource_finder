"""Build cf/public/ for the Cloudflare Pages deploy.

- Copies the UI from app/static (single source of truth) plus stepwise.js
- Splits data/snapshot_ca.json into one file per county + statewide.json
- Copies data/rules_ca.json and writes data/presets.json from evals/profiles.json
Run from anywhere: python3 scripts/build_cf_assets.py
"""
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / "cf" / "public"
STATIC = ROOT / "app" / "static"


def slug(c: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r" county$", "", (c or "").strip().lower(), flags=re.I))


def main():
    (PUB / "data" / "snapshot").mkdir(parents=True, exist_ok=True)
    for f in STATIC.iterdir():
        if f.is_file():
            shutil.copy2(f, PUB / f.name)
    shutil.copy2(ROOT / "cf" / "stepwise.js", PUB / "stepwise.js")
    # Load stepwise.js before app.js in the deployed page.
    html = (PUB / "index.html").read_text()
    if "stepwise.js" not in html:
        html = html.replace('<script src="app.js"', '<script src="stepwise.js"></script>\n  <script src="app.js"', 1)
        (PUB / "index.html").write_text(html)

    snap = json.loads((ROOT / "data" / "snapshot_ca.json").read_text())
    by = defaultdict(list)
    for r in snap:
        c = (r.get("county") or "").replace(" County", "").strip()
        by["statewide" if c.lower() in ("", "statewide", "california", "online") else slug(c)].append(r)
    for old in (PUB / "data" / "snapshot").glob("*.json"):
        old.unlink()
    for k, rows in by.items():
        (PUB / "data" / "snapshot" / f"{k}.json").write_text(json.dumps(rows, separators=(",", ":")))
    shutil.copy2(ROOT / "data" / "rules_ca.json", PUB / "data" / "rules_ca.json")

    profiles = json.loads((ROOT / "evals" / "profiles.json").read_text())
    presets = [{"id": p["id"], "label": p.get("label"), "summary": p.get("summary", ""),
                "profile": {k: v for k, v in p.items() if k not in ("preset", "label", "summary")}}
               for p in profiles if p.get("preset")]
    (PUB / "data" / "presets.json").write_text(json.dumps(presets))
    biggest = max(by.items(), key=lambda kv: len(kv[1]))
    print(f"{len(by)} county files, largest {biggest[0]} ({len(biggest[1])} records); {len(presets)} presets")


if __name__ == "__main__":
    main()
