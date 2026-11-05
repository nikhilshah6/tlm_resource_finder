"""Public resource APIs the finder agents call.

Only public resource data is sent to these APIs (coordinates, city, ZIP). No alumni details.
Every function returns a list of Candidate dicts (max 15) and never raises: on failure it
returns {"error": "..."} so the agent can carry on.
"""
from __future__ import annotations

import json
import math
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import httpx

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
TIMEOUT = httpx.Timeout(15.0, connect=8.0)
UA = {"User-Agent": "reentry-agents-demo/0.1 (nonprofit prototype)"}
MAX = 15

# Neighbor counties so a search doesn't stop at a county line (parole limits are applied by the agents).
NEIGHBORS = {
    "Alameda": ["Contra Costa", "San Francisco", "Santa Clara", "San Joaquin"],
    "San Francisco": ["San Mateo", "Alameda", "Marin"],
    "Contra Costa": ["Alameda", "Solano"],
    "Los Angeles": ["Orange", "San Bernardino", "Ventura", "Kern"],
    "Orange": ["Los Angeles", "Riverside", "San Diego"],
    "San Diego": ["Orange", "Riverside", "Imperial"],
    "Riverside": ["San Bernardino", "Orange", "San Diego"],
    "San Bernardino": ["Riverside", "Los Angeles"],
    "Sacramento": ["Placer", "Yolo", "San Joaquin", "El Dorado"],
    "Fresno": ["Madera", "Tulare", "Kings"],
    "Kern": ["Tulare", "Los Angeles", "San Bernardino"],
    "Santa Clara": ["San Mateo", "Alameda", "Santa Cruz"],
    "San Joaquin": ["Sacramento", "Stanislaus", "Alameda"],
}


def _miles(lat1, lon1, lat2, lon2) -> Optional[float]:
    try:
        lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
    except (TypeError, ValueError):
        return None
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 1)


def _clean_county(c: Optional[str]) -> str:
    return (c or "").replace(" County", "").strip()


# ---------------------------------------------------------------- geocode
async def geocode(place: str) -> dict:
    """ZIP or 'City' (California) -> {lat, lon, city, zip}. Uses the no-key Zippopotam API."""
    place = (place or "").strip()
    async with httpx.AsyncClient(timeout=TIMEOUT, headers=UA) as c:
        try:
            if place[:5].isdigit():
                r = await c.get(f"https://api.zippopotam.us/us/{place[:5]}")
                r.raise_for_status()
                p = r.json()["places"][0]
                return {"lat": float(p["latitude"]), "lon": float(p["longitude"]), "city": p["place name"], "zip": place[:5]}
            r = await c.get(f"https://api.zippopotam.us/us/ca/{place.replace(' ', '%20')}")
            r.raise_for_status()
            p = r.json()["places"][0]
            return {"lat": float(p["latitude"]), "lon": float(p["longitude"]), "city": place, "zip": p["post code"]}
        except Exception as e:  # noqa: BLE001
            return {"error": f"geocode failed for {place!r}: {e}"}


# ---------------------------------------------------------------- FindTreatment.gov (no key)
async def find_treatment(lat: float, lon: float, miles: float = 10, keyword: str = "") -> Any:
    url = "https://findtreatment.gov/locator/exportsAsJson/v2"
    params = {"sAddr": f"{lat},{lon}", "limitType": 2, "limitValue": int(miles * 1609.34), "pageSize": 25, "page": 1}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers=UA) as c:
            r = await c.get(url, params=params)
            r.raise_for_status()
            rows = r.json().get("rows", [])
    except Exception as e:  # noqa: BLE001
        return {"error": f"FindTreatment.gov failed: {e}"}
    out = []
    kw = keyword.lower()
    for row in rows:
        name = " - ".join(x for x in [row.get("name1"), row.get("name2")] if x)
        if kw and kw not in json.dumps(row).lower():
            continue
        out.append({
            "name": name, "category": "health",
            "description": f"Substance use / mental health treatment ({row.get('typeFacility') or 'facility'})",
            "address": ", ".join(x for x in [row.get("street1"), row.get("street2")] if x),
            "city": row.get("city"), "phone": row.get("phone") or row.get("intake1"),
            "url": row.get("website"), "distance_miles": row.get("miles"),
            "source": "findtreatment", "source_url": "https://findtreatment.gov/",
        })
    return out[:MAX]


# ---------------------------------------------------------------- HUD housing counselors (no key)
async def hud_counselors(lat: float, lon: float, miles: float = 10) -> Any:
    url = "https://data.hud.gov/Housing_Counselor/searchByLocation"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers=UA) as c:
            r = await c.get(url, params={"Lat": lat, "Long": lon, "Distance": miles})
            r.raise_for_status()
            rows = r.json()
    except Exception as e:  # noqa: BLE001
        return {"error": f"HUD housing counselor API failed: {e}"}
    out = []
    for a in rows:
        out.append({
            "name": (a.get("nme") or "").title(), "category": "housing",
            "description": "HUD-approved housing counseling agency (rental help, homelessness prevention, finding housing)",
            "address": " ".join(x for x in [a.get("adr1"), a.get("adr2")] if x), "city": a.get("city"),
            "phone": a.get("phone1"), "url": a.get("weburl"),
            "who_it_serves": f"Languages: {a.get('languages')}" if a.get("languages") else None,
            "distance_miles": _miles(lat, lon, a.get("agc_ADDR_LATITUDE"), a.get("agc_ADDR_LONGITUDE")),
            "source": "hud", "source_url": "https://data.hud.gov/Housing_Counselor/",
        })
    out.sort(key=lambda x: x["distance_miles"] if x["distance_miles"] is not None else 99)
    return out[:MAX]


# ---------------------------------------------------------------- FDIC BankFind (no key)
async def fdic_branches(city: str = "", zip: str = "") -> Any:
    flt = "STALP:CA"
    if zip:
        flt += f" AND ZIP:{zip[:5]}"
    elif city:
        flt += f' AND CITY:"{city}"'
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers=UA) as c:
            r = await c.get("https://api.fdic.gov/banks/locations", params={
                "filters": flt, "fields": "NAME,ADDRESS,CITY,ZIP,OFFNAME", "limit": 25})
            r.raise_for_status()
            rows = [d["data"] for d in r.json().get("data", [])]
    except Exception as e:  # noqa: BLE001
        return {"error": f"FDIC BankFind failed: {e}"}
    out, seen = [], set()
    for b in rows:
        key = (b.get("NAME"), b.get("ADDRESS"))
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "name": f"{b.get('NAME')} - {b.get('OFFNAME') or 'branch'}", "category": "legal_id",
            "description": "FDIC-insured bank branch (check for a second-chance or Bank On certified account)",
            "address": b.get("ADDRESS"), "city": b.get("CITY"),
            "source": "fdic", "source_url": "https://banks.data.fdic.gov/bankfind-suite/",
        })
    return out[:MAX]


# ---------------------------------------------------------------- CareerOneStop (free key)
async def careeronestop_ajc(location: str, radius: int = 25) -> Any:
    uid, tok = os.getenv("CAREERONESTOP_USER_ID"), os.getenv("CAREERONESTOP_TOKEN")
    if not uid or not tok:
        return {"error": "CareerOneStop key not configured; use snapshot and web search for job centers"}
    url = f"https://api.careeronestop.org/v1/ajcfinder/{uid}/{location}/{radius}/0/0/0/0/0/0/0/15"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers={**UA, "Authorization": f"Bearer {tok}"}) as c:
            r = await c.get(url)
            r.raise_for_status()
            rows = r.json().get("OneStopCenterList", [])
    except Exception as e:  # noqa: BLE001
        return {"error": f"CareerOneStop failed: {e}"}
    return [{
        "name": j.get("Name"), "category": "jobs",
        "description": "America's Job Center of California: job search help, training funds (WIOA), reentry services",
        "address": j.get("Address1"), "city": j.get("City"), "phone": j.get("Phone"),
        "url": j.get("WebSiteUrl"), "distance_miles": _float(j.get("Distance")),
        "source": "careeronestop", "source_url": "https://www.careeronestop.org/LocalHelp/AmericanJobCenters/find-american-job-centers.aspx",
    } for j in rows][:MAX]


def _float(x):
    try:
        return round(float(x), 1)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- 211 (trial key, optional)
async def search_211(query: str, lat: float, lon: float) -> Any:
    key = os.getenv("TWO11_API_KEY")
    if not key:
        return {"error": "211 API key not configured; search 211 county websites with web search instead"}
    url = "https://api.211.org/search/v1/api/Search/Keyword"
    params = {"Keyword": query, "Location": f"{lat},{lon}", "Distance": 15, "Top": 10}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers={**UA, "Api-Key": key}) as c:
            r = await c.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:  # noqa: BLE001
        return {"error": f"211 API failed: {e}"}
    rows = data.get("results") or data.get("value") or data if isinstance(data, list) else data.get("results", [])
    out = []
    for d in rows if isinstance(rows, list) else []:
        doc = d.get("document", d)
        out.append({
            "name": doc.get("nameService") or doc.get("nameOrganization") or doc.get("name"),
            "category": "housing", "description": doc.get("descriptionService") or doc.get("description"),
            "address": doc.get("address1PhysicalAddress"), "city": doc.get("cityPhysicalAddress"),
            "phone": doc.get("phone"), "url": doc.get("website"),
            "source": "211", "source_url": "https://apiportal.211.org/",
        })
    return out[:MAX]


# ---------------------------------------------------------------- local snapshot + rules
@lru_cache(maxsize=1)
def _snapshot() -> list[dict]:
    p = DATA / "snapshot_ca.json"
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text())
    except Exception:  # noqa: BLE001
        return []


@lru_cache(maxsize=1)
def _rules() -> list[dict]:
    p = DATA / "rules_ca.json"
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text())
    except Exception:  # noqa: BLE001
        return []


def search_snapshot(category: str, county: str, keywords: str = "", lat: float | None = None, lon: float | None = None) -> Any:
    county = _clean_county(county)
    counties = {county.lower()} | {c.lower() for c in NEIGHBORS.get(county, [])}
    kws = [k for k in keywords.lower().replace(",", " ").split() if len(k) > 2]
    scored = []
    for rec in _snapshot():
        if rec.get("category") != category:
            continue
        rc = _clean_county(rec.get("county")).lower()
        statewide = rc in ("", "statewide", "california", "online")
        if not statewide and rc not in counties:
            continue
        text = json.dumps(rec).lower()
        score = sum(text.count(k) for k in kws)
        if rc == county.lower():
            score += 3
        if rec.get("tlm_network"):
            score += 2
        if statewide:
            score += 1
        scored.append((score, rec))
    scored.sort(key=lambda x: -x[0])
    return [r for _, r in scored[:MAX]]


def lookup_rule(topic: str) -> Any:
    t = topic.lower()
    hits = [r for r in _rules() if any(w in (r.get("topic", "") + " " + r.get("rule", "")).lower() for w in t.replace("_", " ").split() if len(w) > 2)]
    if not hits:
        return {"note": f"No stored rule for {topic!r}. Look it up on an official page with web_search.",
                "topics": [r.get("topic") for r in _rules()]}
    return hits[:6]
