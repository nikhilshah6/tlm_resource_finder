"""Build the agent data the hub site serves: site/data/agent/.

- Splits data/snapshot_ca.json (from scripts/build_snapshot.py) into one file per county plus statewide.json,
  so a Pages Function only loads the counties it needs.
- Copies data/rules_ca.json.
Saved demo plans (site/data/agent/demo-plans/) are recorded from live runs and are not touched.
Run from anywhere: python3 scripts/build_agent_data.py
"""
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site" / "data" / "agent"


def slug(c: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r" county$", "", (c or "").strip().lower(), flags=re.I))


def main():
    (OUT / "snapshot").mkdir(parents=True, exist_ok=True)
    snap = json.loads((ROOT / "data" / "snapshot_ca.json").read_text())
    by = defaultdict(list)
    for r in snap:
        c = (r.get("county") or "").replace(" County", "").strip()
        by["statewide" if c.lower() in ("", "statewide", "california", "online") else slug(c)].append(r)
    for old in (OUT / "snapshot").glob("*.json"):
        old.unlink()
    for k, rows in by.items():
        (OUT / "snapshot" / f"{k}.json").write_text(json.dumps(rows, separators=(",", ":")))
    shutil.copy2(ROOT / "data" / "rules_ca.json", OUT / "rules_ca.json")
    biggest = max(by.items(), key=lambda kv: len(kv[1]))
    print(f"{len(by)} county files, largest {biggest[0]} ({len(biggest[1])} records)")


if __name__ == "__main__":
    main()
