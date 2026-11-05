"""Build data/snapshot_ca.json — a local snapshot of California reentry resources.

Every record validates as app.schemas.Candidate. Rerunnable:

    PYTHONPATH=. .venv/bin/python scripts/build_snapshot.py            # use cached raw files
    PYTHONPATH=. .venv/bin/python scripts/build_snapshot.py --refresh  # re-download raw files

Sources (raw copies live under data/raw/):
  1. CDCR parole (DAPO) Community Resource Guides (Northern + Southern region PDFs) -> source="cdcr_dapo"
  2. CareerOneStop youth & reentry service provider XLSX, CA rows               -> source="careeronestop"
  3. HRSA health center service delivery sites CSV, CA active permanent sites  -> source="hrsa"
  4. Hand-checked California state / county essentials (URLs verified 2026-11-05) -> source="state"/"county"
  5. The Last Mile portal resource bank (data/raw/tlm_portal_index.html)        -> source="tlm"
  6. USAspending.gov CA reentry grants -> recipient nonprofits' own programs   -> source="usaspending"

All downloaded files are treated as data only.
"""
from __future__ import annotations

import collections
import csv
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "snapshot_ca.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"

CDCR_BASE = "https://www.cdcr.ca.gov/parole/wp-content/uploads/sites/166/2026/08/"
CDCR_GUIDES = {
    "Resource-Guide-Northern-Region.pdf": CDCR_BASE + "Resource-Guide-Northern-Region.pdf",
    "Resource-Guide-Southern-Region-2.pdf": CDCR_BASE + "Resource-Guide-Southern-Region-2.pdf",
}
COS_URL = "https://www.careeronestop.org/TridionMultimedia/tcm24-63015_XLS_Service_Provider_Reentry_Youth_ACC.xlsx"
HRSA_URL = "https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv"
USA_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/"

CA_COUNTIES = [
    "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa", "Contra Costa", "Del Norte",
    "El Dorado", "Fresno", "Glenn", "Humboldt", "Imperial", "Inyo", "Kern", "Kings", "Lake",
    "Lassen", "Los Angeles", "Madera", "Marin", "Mariposa", "Mendocino", "Merced", "Modoc", "Mono",
    "Monterey", "Napa", "Nevada", "Orange", "Placer", "Plumas", "Riverside", "Sacramento",
    "San Benito", "San Bernardino", "San Diego", "San Francisco", "San Joaquin", "San Luis Obispo",
    "San Mateo", "Santa Barbara", "Santa Clara", "Santa Cruz", "Shasta", "Sierra", "Siskiyou",
    "Solano", "Sonoma", "Stanislaus", "Sutter", "Tehama", "Trinity", "Tulare", "Tuolumne",
    "Ventura", "Yolo", "Yuba",
]
COUNTY_SET = set(CA_COUNTIES)


# ----------------------------------------------------------------------------- helpers
def download(url: str, dest: Path, refresh: bool, data: bytes | None = None) -> Path:
    if dest.exists() and not refresh:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        dest.write_bytes(r.read())
    print(f"  downloaded {url} -> {dest.relative_to(ROOT)}")
    return dest


def clean(s: str | None) -> str | None:
    if s is None:
        return None
    s = re.sub(r"\s+", " ", str(s).replace("\u2022", " ")).strip(" ;,")
    return s or None


PHONE_RE = re.compile(r"(?:1[-. ]?)?\(?\b(\d{3})\)?[-. ]?(\d{3})[-. ]?(\d{4})\b")


def norm_phone(s: str | None) -> str | None:
    if not s:
        return None
    m = PHONE_RE.search(s)
    if not m:
        return None
    return f"({m.group(1)}) {m.group(2)}-{m.group(3)}"


def norm_url(s: str | None) -> str | None:
    if not s:
        return None
    s = s.strip()
    m = re.search(r"https?://\S+", s)
    if m:
        u = m.group(0)
    elif re.match(r"^(www\.)?[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(/\S*)?$", s):
        u = "https://" + s
    else:
        return None
    return u.rstrip(".,;)")


def norm_county(s: str | None) -> str | None:
    if not s:
        return None
    s = re.sub(r"\s+County$", "", s.strip(), flags=re.I).strip()
    for c in CA_COUNTIES:
        if s.lower() == c.lower():
            return c
    return None


ZIP2CITY: dict[str, str] = {}
CITY_RE2 = re.compile(r"(?:^|\s)([A-Z][a-z]+(?: [A-Z][a-z]+){0,2}),?\s+(?:CA|Ca\.?|California),?\s+(\d{5})")
CITY_RE = re.compile(r",\s*([A-Z][A-Za-z .'\-]{1,40}?),?\s+(?:CA|Ca\.?|California)\b\.?\s*(\d{5})?")


def parse_city(addr: str | None) -> tuple[str | None, str | None]:
    if not addr:
        return None, None
    m = CITY_RE.search(addr) or CITY_RE2.search(addr)
    if not m:
        z = re.search(r"\b(9[0-6]\d{3})\b", addr)
        return (ZIP2CITY.get(z.group(1)) if z else None), (z.group(1) if z else None)
    city = m.group(1).strip()
    zc = ZIP2CITY.get(m.group(2) or "")
    if zc and city.lower() != zc.lower() and city.lower().endswith(" " + zc.lower()):
        city = zc  # e.g. "Suite 200 Fresno" -> "Fresno"
    city = re.sub(r"^(Suite|Ste\.?|Unit|#)\s*\S+\s*", "", city).strip()
    return city or None, m.group(2)


CATEGORY_KEYWORDS = {
    "housing": ["housing", "shelter", "sober living", "transitional living", "residential", "rent", "homeless", "beds"],
    "health": ["health", "medical", "clinic", "mental", "substance", "treatment", "recovery", "detox", "counseling", "dental"],
    "food_benefits": ["food", "meal", "pantry", "calfresh", "groceries", "nutrition", "benefits enrollment"],
    "jobs": ["employment", "job", "career", "workforce", "training", "vocational", "ged", "education", "apprentice", "resume"],
    "legal_id": ["legal", "expunge", "record clearance", "clean slate", "attorney", "identification", "id card", "documents"],
    "family": ["family", "parent", "children", "reunification", "child support", "custody", "domestic violence"],
    "clothing": ["clothing", "clothes", "interview attire", "wardrobe"],
}


def classify(text: str, default: str = "jobs") -> str:
    t = (text or "").lower()
    scores = {c: sum(t.count(k) for k in kws) for c, kws in CATEGORY_KEYWORDS.items()}
    best = max(scores, key=lambda c: scores[c])
    return best if scores[best] > 0 else default


REENTRY_RE = re.compile(r"(?i)\b(parole|parolee|reentry|re-entry|formerly incarcerated|incarcerat|justice[- ]involved|ex-offender|returning citizen|release)")


def who_from_text(text: str | None) -> str | None:
    if text and REENTRY_RE.search(text):
        return "Explicitly serves people on parole/probation or returning from incarceration (per program description)"
    return None


# ----------------------------------------------------------------------------- 1. CDCR DAPO guides
SECTION_CAT = {
    "behavioral health": "health",
    "health care": "health",
    "substance use": "health",
    "housing": "housing",
    "employment & training": "jobs",
    "education": "jobs",
    "hse/ged": "jobs",
    "food assistance": "food_benefits",
    "multi-services": None,
    "multi-servies": None,
}
FIELD_RE = re.compile(
    r"^(Address|Addresses|Location|Locations|Mailing Address|Phone|Phones|Office Line|Hotline|Website|"
    r"Services include|Services|Service|Hours|Email|Contact Portal|Contact|Fax|Distribution|Time)\s*:\s*(.*)$"
)
FIELD_KEY = {
    "address": "address", "addresses": "address", "location": "address", "locations": "address",
    "mailing address": "address", "phone": "phone", "phones": "phone", "office line": "phone",
    "hotline": "phone", "website": "website", "contact portal": "website", "services include": "services",
    "services": "services", "service": "services", "hours": "hours", "time": "hours", "email": "other",
    "contact": "other", "fax": "other", "distribution": "hours",
}


def extract_pdf_text(pdf: Path) -> str:
    txt = pdf.with_suffix(".txt")
    if txt.exists() and txt.stat().st_mtime >= pdf.stat().st_mtime:
        return txt.read_text()
    import pypdf  # noqa: PLC0415

    r = pypdf.PdfReader(str(pdf))
    t = "\n\f".join((p.extract_text() or "") for p in r.pages)
    txt.write_text(t)
    return t


ADDRLIKE = re.compile(r"^\d+[A-Za-z]?\s+\S+.*(?:\b(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Ln|Lane|Hwy|Highway)\b|\bCA\b\.?\s*\d{5})")


def parse_cdcr_guide(text: str, source_url: str) -> list[dict]:
    lines = []
    for raw in text.splitlines():
        l = raw.replace("\f", "").strip()
        if l.startswith("California Department of Corrections and Rehabilitation"):
            continue
        if re.fullmatch(r"\d{1,3}", l):
            continue
        lines.append(l)

    # counties from TOC, in order
    toc = []
    for l in lines:
        m = re.match(r"^([A-Z][A-Za-z ]+?)(?: County)?\s*\.{4,}", l)
        if m and norm_county(m.group(1)) and norm_county(m.group(1)) not in toc:
            toc.append(norm_county(m.group(1)))

    out: list[dict] = []
    county = None
    county_idx = -1
    section = None
    pending: list[str] = []
    cur: dict | None = None
    field = None

    def finish():
        nonlocal cur, field
        if cur is not None:
            out.append(cur)
        cur, field = None, None

    for l in lines:
        if "...." in l:
            continue
        # county header
        m = re.fullmatch(r"([A-Z][A-Za-z ]+?)(?: County)?", l)
        if m and (l.endswith("County") or l in COUNTY_SET):
            c = norm_county(m.group(1))
            if c and c in toc and toc.index(c) > county_idx:
                finish()
                county, county_idx, section, pending = c, toc.index(c), None, []
                continue
        if l.lower() in SECTION_CAT:
            finish()
            section, pending = l.lower(), []
            continue
        if not l:
            if field == "services":
                finish()
            continue
        fm = FIELD_RE.match(l)
        if fm:
            key = FIELD_KEY[fm.group(1).lower()]
            val = fm.group(2)
            if cur is None or (key in cur and key in ("address", "services")):
                finish()
                name = None
                if pending:
                    name = pending[-1]
                    if ADDRLIKE.match(name) and len(pending) >= 2:
                        name = pending[-2]
                    if len(pending) >= 2 and (name[:1].islower() or name.startswith("(")):
                        name = pending[-2] + " " + name
                cur = {"name": name, "county": county, "section": section}
                if pending and ADDRLIKE.match(pending[-1]) and key != "address":
                    cur["address"] = pending[-1]
                pending = []
            if key == "other":
                field = "other"
                continue
            cur[key] = (cur.get(key, "") + " " + val).strip() if key in cur else val
            field = key
            continue
        # plain text line
        if cur is not None and field and field != "other":
            if field == "website" and cur.get("website", "").endswith(("-", "/", "_")) and " " not in l:
                cur["website"] += l
            elif field == "website" and re.match(r"^[\w\-./?=&%#]+$", l) and cur.get("website", "").startswith("http") and "." not in l[:1]:
                cur["website"] += l
            elif field in ("services", "address", "hours", "phone"):
                cur[field] += " " + l
            else:
                finish()
                pending = [l]
        elif cur is not None and field == "other":
            continue
        else:
            pending.append(l)
    finish()

    recs = []
    for e in out:
        name = clean(e.get("name"))
        if not name or not e.get("county") or len(name) > 110 or name.endswith("."):
            continue
        if re.match(r"(?i)^(no resources|services|website|phone|address)", name) or ADDRLIKE.match(name):
            continue
        name = re.sub(r"\s*[–-]\s*$", "", name)
        services = clean(e.get("services"))
        address = clean(e.get("address"))
        addr_out = address
        if address and re.match(r"(?i)^(refer|unavailable|not available|n/?a\b|none|confidential|various|varies|multiple|"
                                 r"telephone|teleservices|virtual|online|call|statewide|countywide)", address):
            addr_out = None
        url = norm_url(e.get("website"))
        phone = norm_phone(e.get("phone"))
        if not (url or phone or addr_out):
            continue
        city, _zip = parse_city(addr_out)
        cat = SECTION_CAT.get(e.get("section") or "")
        if cat is None:
            cat = classify(f"{name} {services or ''}", default="jobs")
        recs.append({
            "name": name,
            "category": cat,
            "description": services,
            "address": addr_out,
            "city": city,
            "county": e["county"],
            "phone": phone,
            "url": url,
            "hours": clean(e.get("hours")),
            "who_it_serves": who_from_text(services),
            "source": "cdcr_dapo",
            "source_url": source_url,
        })
    return recs


# ----------------------------------------------------------------------------- 3. HRSA (also builds city/zip -> county maps)
def load_hrsa(path: Path):
    zip2county: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    city2county: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    zip2city: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    recs = []
    with open(path, encoding="utf-8-sig", errors="replace") as f:
        for r in csv.DictReader(f):
            if r["Site State Abbreviation"] != "CA":
                continue
            county = norm_county(r["County Equivalent Name"])
            z = (r["Site Postal Code"] or "")[:5]
            city = clean(r["Site City"])
            if city:
                zip2city[z][city] += 1
            if county:
                zip2county[z][county] += 1
                if city:
                    city2county[city.lower()][county] += 1
            if r["Site Status Description"] != "Active":
                continue
            if r["Health Center Location Type Description"] != "Permanent":
                continue
            if r["Health Center Type Description"] == "Administrative":
                continue
            setting = r["Health Center Service Delivery Site Location Setting Description"]
            if setting in ("School", "Transitional Care in Carceral Setting"):
                continue
            if re.search(r"(?i)pediatric|children|\bkids\b|\bteen|\bWIC\b|school", r["Site Name"]):
                continue
            hrs = r["Operating Hours per Week"]
            try:
                hours = f"{float(hrs):g} hours/week" if hrs else None
            except ValueError:
                hours = None
            org = clean(r["Health Center Name"])
            fqhc = "FQHC Look-Alike" if "Look-Alike" in r["Health Center Type"] else "Federally Qualified Health Center"
            recs.append({
                "name": clean(r["Site Name"]),
                "category": "health",
                "description": f"{fqhc} site operated by {org}. Primary care; many sites also offer behavioral health, dental and pharmacy (call to confirm).",
                "address": clean(f'{r["Site Address"]}, {r["Site City"]}, CA {r["Site Postal Code"]}'),
                "city": city,
                "county": county,
                "phone": norm_phone(r["Site Telephone Number"]),
                "url": norm_url(r["Site Web Address"]),
                "hours": hours,
                "who_it_serves": "Anyone, insured or uninsured; Medi-Cal accepted; fees on a sliding scale by income",
                "cost": "Sliding fee scale",
                "source": "hrsa",
                "source_url": HRSA_URL,
            })
    z2c = {z: c.most_common(1)[0][0] for z, c in zip2county.items()}
    c2c = {k: c.most_common(1)[0][0] for k, c in city2county.items()}
    ZIP2CITY.update({z: c.most_common(1)[0][0].title() for z, c in zip2city.items()})
    return recs, z2c, c2c


# ----------------------------------------------------------------------------- 2. CareerOneStop
def load_careeronestop(path: Path, z2c: dict, c2c: dict) -> list[dict]:
    import openpyxl  # noqa: PLC0415

    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    hdr = [str(h).strip() for h in next(rows)]
    recs = []
    for row in rows:
        r = dict(zip(hdr, row))
        if str(r.get("State") or "").strip() != "CA":
            continue
        adult = str(r.get("Reentry Programs for Adults") or "").upper() == "Y"
        youth = str(r.get("Reentry Programs for Youth") or "").upper() == "Y"
        if not (adult or youth):
            continue
        name = clean(r.get("Resource"))
        desc = clean(r.get("Description"))
        city = clean(r.get("City"))
        z = str(r.get("Zip Code") or "").strip()[:5]
        county = z2c.get(z) or (c2c.get(city.lower()) if city else None)
        street = ", ".join(x for x in [clean(r.get("Address_1")), clean(r.get("Address_2"))] if x)
        addr = clean(f"{street}, {city}, CA {z}") if (street or city) else None
        serves = "Adults returning from incarceration" if adult and not youth else (
            "Youth (justice-involved)" if youth and not adult else "Adults and youth returning from incarceration")
        recs.append({
            "name": name,
            "category": classify(f"{name} {desc or ''}", default="jobs"),
            "description": desc,
            "address": addr,
            "city": city,
            "county": county,
            "phone": norm_phone(str(r.get("Phone") or "")),
            "url": norm_url(str(r.get("WEB Address") or "")),
            "who_it_serves": serves,
            "source": "careeronestop",
            "source_url": COS_URL,
        })
    return recs


# ----------------------------------------------------------------------------- 4. State / county essentials (hand-checked 2026-11-05)
STATE_ESSENTIALS = [
    dict(name="CalFresh (apply via GetCalFresh)", category="food_benefits", source="state",
         url="https://www.getcalfresh.org/", phone="(877) 847-3663",
         description="California's SNAP food benefits. Apply online in about 10 minutes at GetCalFresh or BenefitsCal; benefits load on an EBT card. People with prior drug felony convictions are eligible in California (W&I Code 18901.3).",
         who_it_serves="Low-income Californians, including people recently released from prison or jail",
         intake_requirements="Interview with county; proof of identity, income and expenses (can be submitted after applying)",
         cost="Free", source_url="https://www.getcalfresh.org/"),
    dict(name="BenefitsCal (CalFresh, Medi-Cal, CalWORKs, General Assistance online application)", category="food_benefits", source="state",
         url="https://benefitscal.com/", description="California's statewide online portal to apply for and manage CalFresh, Medi-Cal, CalWORKs and (in many counties) General Assistance/General Relief.",
         cost="Free", source_url="https://benefitscal.com/"),
    dict(name="Medi-Cal (apply for free or low-cost health coverage)", category="health", source="state",
         url="https://www.dhcs.ca.gov/services/medi-cal/Pages/ApplyforMedi-Cal.aspx",
         description="California's Medicaid program. Adults 19-64 with income up to 138% FPL qualify for full-scope coverage. Apply online (BenefitsCal or Covered California), by phone, mail, or at the county social services office. People leaving CDCR can have applications submitted pre-release under CalAIM.",
         who_it_serves="Low-income Californians; people leaving prison/jail (pre-release enrollment under CalAIM Justice-Involved Initiative)",
         cost="Free for most enrollees", source_url="https://www.dhcs.ca.gov/services/medi-cal/Pages/ApplyforMedi-Cal.aspx"),
    dict(name="California LifeLine (discounted phone / broadband service)", category="food_benefits", source="state",
         url="https://www.californialifeline.com/en",
         description="State program providing discounted home or cell phone service (and broadband discounts). Qualify through enrollment in Medi-Cal, CalFresh, SSI and other programs, or by household income.",
         who_it_serves="Households enrolled in a qualifying assistance program or under the LifeLine income limit",
         intake_requirements="Proof of program enrollment or income", cost="Discounted / free phone service",
         source_url="https://www.cpuc.ca.gov/lifeline"),
    dict(name="CDCR CAL-ID Program (state ID card at release from prison)", category="legal_id", source="state",
         url="https://www.cdcr.ca.gov/rehabilitation/calid/",
         description="CDCR and DMV program that provides a valid California ID card to eligible people upon release from state prison (Penal Code 3007.05). Available at all CDCR institutions, within 13 months of release.",
         who_it_serves="People incarcerated in CDCR institutions who are within 13 months of release",
         intake_requirements="Must have a Social Security Number and a prior California DMV-issued ID card or driver's license; ask your correctional counselor",
         cost="Free", source_url="https://www.cdcr.ca.gov/rehabilitation/calid/"),
    dict(name="DMV ID Card (reduced-fee and no-fee ID)", category="legal_id", source="state",
         url="https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/identification-id-cards/",
         description="Apply for a California ID card at a DMV office. Reduced-fee ID for people who meet income requirements of public assistance programs (bring form DL 937 from the program); no-fee ID for people experiencing homelessness (McKinney-Vento definition).",
         intake_requirements="ID card application, SSN, identity document, residency documents if first CA card; DL 937 (reduced fee) or homeless verification (no fee)",
         cost="Standard fee; reduced or no fee if eligible",
         source_url="https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/identification-id-cards/"),
    dict(name="CalJOBS (California's online job bank)", category="jobs", source="state",
         url="https://www.caljobs.ca.gov/",
         description="EDD's free statewide job search and workforce services system: job listings, resume builder, and links to local America's Job Center of California (AJCC) services and training funds.",
         cost="Free", source_url="https://www.caljobs.ca.gov/"),
    dict(name="America's Job Center of California (AJCC) office locator", category="jobs", source="state",
         url="https://edd.ca.gov/en/office_locator/",
         description="Find your local AJCC for free career counseling, job placement, WIOA-funded training, and reentry employment services. Staff can also connect job seekers to the Federal Bonding Program.",
         cost="Free", source_url="https://edd.ca.gov/en/office_locator/"),
    # ---- county General Relief / General Assistance
    dict(name="Los Angeles County General Relief (GR)", category="food_benefits", source="county", county="Los Angeles",
         city="Los Angeles", url="https://dpss.lacounty.gov/en/cash/gr.html", phone="(866) 613-3777",
         description="County-funded cash aid for indigent adults without dependent children who are not eligible for other cash programs. Amounts and work rules are set by the county.",
         who_it_serves="Low-income adults in LA County with no other means of support", cost="Free",
         source_url="https://dpss.lacounty.gov/en/cash/gr.html"),
    dict(name="Alameda County General Assistance (GA)", category="food_benefits", source="county", county="Alameda",
         url="https://socialservices.alamedacountyca.gov/our-services/Work-and-Money/General-Assistance/index",
         description="Cash aid for indigent adults and emancipated minors who are legal residents of Alameda County with no other means of support. Apply online or at an SSA office (e.g., Eastmont Town Center, Oakland). GA cash is treated as a loan per the application's reimbursement agreement.",
         who_it_serves="Alameda County resident adults without dependent children", cost="Free",
         source_url="https://socialservices.alamedacountyca.gov/our-services/Work-and-Money/General-Assistance/index"),
    dict(name="San Francisco County Adult Assistance Programs (CAAP)", category="food_benefits", source="county", county="San Francisco",
         city="San Francisco", address="1235 Mission Street, San Francisco, CA 94103", phone="(833) 879-1365",
         url="https://www.sfhsa.org/services/financial-assistance/county-adult-assistance-programs-caap",
         description="San Francisco's General Assistance program: cash assistance and employment services for low-income adults with no dependent children. Apply at BenefitsCal.com or in person at 1235 Mission St.",
         who_it_serves="Low-income San Francisco adults with no dependent children", cost="Free",
         source_url="https://www.sfhsa.org/services/financial-assistance/county-adult-assistance-programs-caap"),
    dict(name="Sacramento County General Assistance (GA)", category="food_benefits", source="county", county="Sacramento",
         url="https://ha.saccounty.gov/us/en/benefits/general_assistance.html", phone="(800) 560-0976",
         description="Short-term, county-funded cash aid for eligible indigent adult residents of Sacramento County while they seek work or other support. Recipients sign an SSI interim assistance agreement.",
         who_it_serves="Sacramento County resident adults", cost="Free",
         source_url="https://ha.saccounty.gov/us/en/benefits/general_assistance.html"),
    dict(name="San Diego County General Relief (GR)", category="food_benefits", source="county", county="San Diego",
         url="https://www.sandiegocounty.gov/content/sdc/hhsa/programs/ssp/general_relief.html",
         description="County-funded assistance for indigent adults in San Diego County who are not eligible for other cash aid programs.",
         who_it_serves="San Diego County resident adults", cost="Free",
         source_url="https://www.sandiegocounty.gov/content/sdc/hhsa/programs/ssp/general_relief.html"),
    dict(name="Fresno County General Relief (GR)", category="food_benefits", source="county", county="Fresno",
         url="https://www.fresnocountyca.gov/Departments/Social-Services/Assistance-Programs/General-Relief", phone="(855) 832-8082",
         description="County-funded cash or in-kind aid for basic living costs for individuals and childless couples who don't qualify for other aid programs. Applicants must be Fresno County residents, generally 18+.",
         who_it_serves="Fresno County resident adults and childless couples", cost="Free",
         source_url="https://www.fresnocountyca.gov/Departments/Social-Services/Assistance-Programs/General-Relief"),
    dict(name="Riverside County General Assistance (DPSS)", category="food_benefits", source="county", county="Riverside",
         url="https://rivcodpss.org/dpss-office-locations-calworks-calfresh-child-care-general-assistance-medi-cal-welfare-work",
         phone="(877) 410-8827",
         description="County-funded General Assistance cash aid for adults without dependent children, administered by DPSS. Apply at any DPSS self-sufficiency office (Mon-Fri 8am-5pm) or by phone.",
         who_it_serves="Riverside County resident adults", cost="Free",
         source_url="https://rivcodpss.org/dpss-office-locations-calworks-calfresh-child-care-general-assistance-medi-cal-welfare-work"),
    dict(name="Kern County General Assistance (GA)", category="food_benefits", source="county", county="Kern",
         city="Bakersfield", url="https://www.kcdhs.org/services/apply-for-benefits/general-assistance", phone="(661) 631-6000",
         hours="Mon-Fri 7:30am-4:00pm",
         description="Minimal assistance with rent, utilities, transportation and personal needs for Kern County residents with no other means of support (single adults and couples without minor children). DHS has a Disability Advocate program to help GA applicants apply for SSI.",
         who_it_serves="Kern County single adults and couples without minor children", cost="Free",
         source_url="https://www.kcdhs.org/services/apply-for-benefits/general-assistance"),
    # ---- record relief
    dict(name="SF Public Defender Clean Slate (record clearance)", category="legal_id", source="county", county="San Francisco",
         city="San Francisco", address="555 7th St, San Francisco, CA 94103", phone="(415) 553-9337",
         url="https://sfpublicdefender.org/clients/clean-slate/",
         description="Free legal help clearing San Francisco convictions and arrests: dismissals (PC 1203.4), Prop 47 reductions, certificates of rehabilitation and related relief.",
         who_it_serves="People with San Francisco criminal records", cost="Free",
         source_url="https://sfpublicdefender.org/clients/clean-slate/"),
    dict(name="Los Angeles County Public Defender Record Clearing Unit", category="legal_id", source="county", county="Los Angeles",
         city="Los Angeles", phone="(213) 204-9904", url="https://pubdef.lacounty.gov/events/",
         description="Free record expungement services and mobile record-clearing clinics across LA County (e.g., The Source at Central Library). Check the events page for current clinic dates.",
         who_it_serves="People with Los Angeles County convictions", cost="Free",
         source_url="https://pubdef.lacounty.gov/events/"),
    dict(name="California Courts Self-Help: Clean Your Record", category="legal_id", source="state",
         url="https://selfhelp.courts.ca.gov/clean-your-record",
         description="Official statewide self-help guide to clearing a California record: dismissal/expungement (PC 1203.4, 1203.41, 1203.42), Prop 47 reductions, sealing arrests, and automatic relief. Includes forms and how to find free legal help.",
         cost="Free (court filing fees are often waived)", source_url="https://selfhelp.courts.ca.gov/clean-your-record"),
]

# ----------------------------------------------------------------------------- 5. TLM resource bank (from data/raw/tlm_portal_index.html)
TLM_KEEP_CA = {  # name in portal -> (category, county)
    "Anti-Recidivism Coalition (ARC)": ("housing", "Los Angeles"),
    "A New Way of Life (ANWOL)": ("housing", "Los Angeles"),
    "Dress for Success — San Francisco": ("clothing", "San Francisco"),
    "San Francisco–Marin Food Bank": ("food_benefits", "San Francisco"),
    "CA HIRE Initiative — Direct Cash": ("jobs", None),
    "Federal Pell Grants (Restored)": ("jobs", None),
    "Root & Rebound — Legal Guide": ("legal_id", "Alameda"),
    "SF Clean Slate — Free Expungement": ("legal_id", "San Francisco"),
    "A New Way of Life — Family Reunification": ("family", "Los Angeles"),
    "Project WHAT! / Community Works": ("family", "Alameda"),
}
TLM_KEEP_NATIONAL = {
    "findhelp.org — Local Services by ZIP": "food_benefits",
    "National Reentry Resource Center": "legal_id",
    "Defy Ventures — Entrepreneurship": "jobs",
    "Center for Employment Opportunities": "jobs",
    "Homeboy Industries": "jobs",
    "Goodwill Reentry Services": "jobs",
    "Honest Jobs": "jobs",
    "Jails to Jobs": "jobs",
}
TLM_EXTRA = [  # named in the portal's TLM_NETWORK list without a URL; URL verified 2026-11-05
    dict(name="Clothes the Deal", category="clothing", county="Alameda", city="Oakland",
         url="https://www.clothesthedeal.org/",
         description="Free professional interview clothing and styling. TLM is a referral partner: case managers email reentry@thelastmile.org and TLM sends a referral letter directly.",
         cost="Free", who_it_serves="Job seekers referred by partners, including TLM alumni"),
]


def _js_array(text: str, name: str) -> list[str]:
    i = text.find("const " + name + "=")
    if i < 0:
        return []
    j = text.index("[", i)
    k, depth, ins, st, elems = j, 0, None, None, []
    while k < len(text):
        c = text[k]
        if ins:
            if c == "\\":
                k += 2
                continue
            if c == ins:
                ins = None
        elif c in "\"'`":
            ins = c
        elif c in "[{":
            depth += 1
            if depth == 2 and c == "{":
                st = k
        elif c in "]}":
            depth -= 1
            if depth == 1 and c == "}":
                elems.append(text[st:k + 1])
            if depth == 0:
                break
        k += 1
    return elems


def _js_fields(obj: str) -> dict:
    f: dict = {}
    for k, v in re.findall(r'(\w+):"((?:[^"\\]|\\.)*)"', obj):
        f.setdefault(k, v)
    return f


def load_tlm(path: Path) -> list[dict]:
    t = path.read_text(encoding="utf-8", errors="replace")
    network = set(re.findall(r'"([^"]+)":\{verified:true', t))
    recs = []
    for obj in _js_array(t, "RESOURCES_CA"):
        f = _js_fields(obj)
        if f.get("name") not in TLM_KEEP_CA:
            continue
        cat, county = TLM_KEEP_CA[f["name"]]
        cost = re.search(r'cost:"([^"]+)"', obj)
        addr = clean(f.get("address"))
        if addr and not re.search(r"\d", addr):
            addr = None
        city, _ = parse_city(addr)
        desc = clean(f.get("summary"))
        if f["name"] in network:
            note = re.search(re.escape('"' + f["name"] + '":{') + r'[^}]*note:"([^"]+)"', t)
            if note:
                desc = f"{desc} TLM network: {note.group(1)}"
        recs.append(dict(name=f["name"], category=cat, description=desc, address=addr, city=city,
                         county=county, phone=norm_phone(f.get("phone")), url=f.get("url"),
                         cost=cost.group(1) if cost else None, who_it_serves=who_from_text(desc)))
    for arr in ("NATIONAL_RESOURCES", "FC_ORGS"):
        for obj in _js_array(t, arr):
            f = _js_fields(obj)
            if f.get("name") not in TLM_KEEP_NATIONAL:
                continue
            desc = clean(" — ".join(x for x in [f.get("tag"), f.get("note")] if x)) or None
            county = "Los Angeles" if f["name"] == "Homeboy Industries" else None
            city = "Los Angeles" if county else None
            recs.append(dict(name=f["name"], category=TLM_KEEP_NATIONAL[f["name"]], description=desc,
                             county=county, city=city, url=f.get("url"),
                             who_it_serves=None if county else "National / online — available to California residents"))
    recs.extend(dict(r) for r in TLM_EXTRA)
    for r in recs:
        r.update(source="tlm", tlm_network=True, source_url=r.get("url"))
    return recs


# ----------------------------------------------------------------------------- 6. USAspending -> recipient programs
USA_QUERIES = ["Second Chance Act", "reentry", "recidivism"]
# Recipient (as named in USAspending) -> program record. Government agencies, universities,
# research grants, and non-reentry awards are deliberately skipped. URLs verified 2026-11-05.
USA_PROGRAMS = {
    "VOLUNTEERS OF AMERICA OF LOS ANGELES": dict(
        name="Volunteers of America Los Angeles — Reentry Services", category="housing", county="Los Angeles",
        city="Los Angeles", url="https://voala.org/",
        description="Second Chance Act-funded reentry case management for people leaving LA County jails and juvenile facilities (South LA, Compton, downtown), with housing placement and links to employment, health and substance use treatment."),
    "IMPACT JUSTICE": dict(
        name="Impact Justice — The Homecoming Project", category="housing", county="Alameda", city="Oakland",
        url="https://impactjustice.org/innovation/housing-lab/homecoming-project/",
        description="Matches people returning home after long prison terms with compensated community hosts who rent them a room for about six months, plus reentry support. Operates in Alameda, Contra Costa, Los Angeles and San Francisco counties.",
        who_it_serves="People returning from long prison sentences (typically 10+ years)"),
    "TIME FOR CHANGE FOUNDATION": dict(
        name="Time for Change Foundation — Women's Reentry Program", category="housing", county="San Bernardino",
        city="San Bernardino", url="https://www.timeforchangefoundation.org/",
        description="Housing (emergency, supportive and affordable) plus reentry services, job readiness, addiction counseling and life skills for justice-involved women; FY2024 BJA Improving Adult Reentry grant.",
        who_it_serves="Justice-involved women, priority to San Bernardino and Riverside county residents released in last 6 months"),
    "TURNING POINT ALCOHOL AND DRUG EDUCATION PROGRAM, INC.": dict(
        name="Turning Point Alcohol and Drug Education Program — Reentry", category="health", county="Los Angeles",
        city="Los Angeles", url="https://turningpointaod.com/",
        description="Substance use and mental health services in Los Angeles; BJA Second Chance Act Improving Adult Reentry grantee."),
    "RETRAINING THE VILLAGE": dict(
        name="Retraining the Village — Second Chance Adult Reentry", category="housing", county="San Mateo",
        city="East Palo Alto", url="https://retrainingthevillage.org/",
        description="Transitional housing (East Palo Alto and Madera), meals, career training and behavioral health support for returning citizens, veterans and people at risk of homelessness; Second Chance Act adult reentry project serving people returning to San Mateo County."),
    "MOTHER LODE JOB TRAINING": dict(
        name="Mother Lode Job Training — Reentry Employment", category="jobs", county="Tuolumne", city="Sonora",
        address="197 Mono Way, Suite B, Sonora, CA 95370", phone="(209) 533-3396", url="https://www.mljt.org/",
        description="AJCC operator for Tuolumne, Calaveras, Amador and Mariposa counties; federally funded program to reduce participant recidivism through job training and placement."),
    "COALITION FOR RESPONSIBLE COMMUNITY DEVELOPMENT": dict(
        name="Coalition for Responsible Community Development (CRCD) — Adult Workforce & Reentry", category="jobs",
        county="Los Angeles", city="Los Angeles", url="https://coalitionrcd.org/programs/",
        description="South LA workforce programs for formerly incarcerated adults and young adults: career coaching, industry training, transitional jobs through CRCD Enterprises, and the Vernon-Central/LATTC WorkSource Center."),
    "FAMILY HEALTH CENTERS OF SAN DIEGO INC": dict(
        name="Family Health Centers of San Diego — Justice-Involved Care", category="health", county="San Diego",
        city="San Diego", url="https://www.fhcsd.org/", cost="Sliding fee scale",
        description="Federally qualified health center network; HRSA Quality Improvement Fund award (FY2025) to improve care for justice-involved patients."),
    "UNIVERSITY MUSLIM MEDICAL ASSOCIATION, INC": dict(
        name="UMMA Community Clinic (UMMA Health) — Justice-Involved Care", category="health", county="Los Angeles",
        city="Los Angeles", url="https://www.ummahealthca.org/", cost="Sliding fee scale",
        description="South LA community health center; HRSA Quality Improvement Fund award (FY2025) for justice-involved patients."),
    "BEIT T'SHUVAH": dict(
        name="Beit T'Shuvah — Substance Use Treatment and Reentry", category="health", county="Los Angeles",
        city="Los Angeles", url="https://beittshuvah.org/",
        description="Residential addiction treatment and recovery community in Los Angeles; DOJ-funded comprehensive SUD prevention and treatment program aimed at reducing crime and recidivism."),
    "INTERFACE COMMUNITY": dict(
        name="Interface Children & Family Services — Second Chances Youth Reentry", category="family", county="Ventura",
        city="Camarillo", url="https://www.icfs.org/",
        description="Second Chances community-based youth reentry project (OJJDP Second Chance Act) providing case management and family support for young people returning from detention.",
        who_it_serves="Justice-involved youth and their families"),
}


def load_usaspending(refresh: bool) -> list[dict]:
    seen: dict[str, dict] = {}
    for kw in USA_QUERIES:
        body = json.dumps({
            "filters": {
                "keywords": [kw],
                "award_type_codes": ["02", "03", "04", "05"],
                "place_of_performance_locations": [{"country": "USA", "state": "CA"}],
                "time_period": [{"start_date": "2024-10-01", "end_date": "2026-09-30"}],
            },
            "fields": ["Award ID", "Recipient Name", "Award Amount", "Description"],
            "limit": 50,
        }).encode()
        dest = RAW / "usaspending" / (kw.replace(" ", "_") + ".json")
        try:
            download(USA_URL, dest, refresh, data=body)
        except Exception as e:  # noqa: BLE001
            print(f"  usaspending '{kw}' failed: {e}")
            continue
        for a in json.loads(dest.read_text()).get("results", []):
            rn = (a.get("Recipient Name") or "").strip().upper()
            if rn in USA_PROGRAMS and rn not in seen:
                seen[rn] = a
    recs = []
    for rn, a in seen.items():
        p = dict(USA_PROGRAMS[rn])
        amt = a.get("Award Amount")
        note = f" Federal award {a.get('Award ID')}" + (f" (${amt:,.0f})" if isinstance(amt, (int, float)) and amt else "") + "."
        p["description"] = (p.get("description") or "") + note
        p.setdefault("who_it_serves", who_from_text(p["description"]))
        p["source"] = "usaspending"
        gid = a.get("generated_internal_id")
        p["source_url"] = f"https://www.usaspending.gov/award/{gid}" if gid else "https://www.usaspending.gov/search"
        recs.append(p)
    return recs


# ----------------------------------------------------------------------------- main
def norm_key(r: dict) -> tuple[str, str, str]:
    """Dedupe key: normalized name + city (falls back to county) + category.

    Category is part of the key so an org listed under several service sections
    (e.g. a housing program and a jobs program) stays findable under each."""
    n = (r.get("name") or "").lower()
    n = re.sub(r"\b(inc|llc|the|of|and|corp|corporation|foundation)\b", " ", n.replace("&", " and "))
    n = re.sub(r"[^a-z0-9]+", "", n)
    c = re.sub(r"[^a-z]", "", (r.get("city") or r.get("county") or "").lower())
    return n, c, r.get("category") or ""


def main() -> None:
    refresh = "--refresh" in sys.argv
    from app.schemas import Candidate  # noqa: PLC0415

    print("Downloading / loading raw sources ...")
    status = {}
    groups: dict[str, list[dict]] = {}

    # 4 + 5 + 6 first so they win dedupe
    groups["state/county"] = [dict(r) for r in STATE_ESSENTIALS]
    status["state/county"] = "ok"
    try:
        groups["tlm"] = load_tlm(RAW / "tlm_portal_index.html")
        status["tlm"] = "ok"
    except Exception as e:  # noqa: BLE001
        status["tlm"] = f"FAILED: {e}"
    try:
        groups["usaspending"] = load_usaspending(refresh)
        status["usaspending"] = "ok"
    except Exception as e:  # noqa: BLE001
        status["usaspending"] = f"FAILED: {e}"

    z2c: dict = {}
    c2c: dict = {}
    try:
        hrsa_path = download(HRSA_URL, RAW / "hrsa" / "Health_Center_Service_Delivery_and_LookAlike_Sites.csv", refresh)
        hrsa, z2c, c2c = load_hrsa(hrsa_path)
        status["hrsa"] = "ok"
    except Exception as e:  # noqa: BLE001
        hrsa = []
        status["hrsa"] = f"FAILED: {e}"
    cdcr = []
    for fn, url in CDCR_GUIDES.items():
        try:
            pdf = download(url, RAW / "cdcr" / fn, refresh)
            recs = parse_cdcr_guide(extract_pdf_text(pdf), url)
            print(f"  CDCR {fn}: {len(recs)} entries parsed")
            cdcr += recs
        except Exception as e:  # noqa: BLE001
            status[f"cdcr {fn}"] = f"FAILED: {e}"
    groups["cdcr_dapo"] = cdcr
    status.setdefault("cdcr_dapo", "ok" if cdcr else "FAILED")

    try:
        cos_path = download(COS_URL, RAW / "careeronestop" / "reentry_youth.xlsx", refresh)
        groups["careeronestop"] = load_careeronestop(cos_path, z2c, c2c)
        status["careeronestop"] = "ok"
    except Exception as e:  # noqa: BLE001
        status["careeronestop"] = f"FAILED: {e}"
    groups["hrsa"] = hrsa

    # fill missing county from city when possible
    for recs in groups.values():
        for r in recs:
            if not r.get("county") and r.get("city"):
                r["county"] = c2c.get(r["city"].lower())

    final: list[dict] = []
    index: dict[tuple, int] = {}
    invalid = 0
    dupes = 0
    for gname, recs in groups.items():
        for r in recs:
            r = {k: v for k, v in r.items() if v is not None}
            try:
                c = Candidate(**r).model_dump()
            except Exception as e:  # noqa: BLE001
                invalid += 1
                if invalid <= 5:
                    print(f"  invalid record from {gname}: {r.get('name')}: {e}")
                continue
            key = norm_key(c)
            if key in index:
                dupes += 1
                kept = final[index[key]]
                if c.get("tlm_network"):
                    kept["tlm_network"] = True
                for f in ("phone", "url", "address", "description", "hours"):
                    if not kept.get(f) and c.get(f):
                        kept[f] = c[f]
                continue
            # drop distance (not meaningful in snapshot)
            c.pop("distance_miles", None)
            index[key] = len(final)
            final.append(c)

    # final validation pass
    for c in final:
        Candidate(**c)
    OUT.write_text(json.dumps(final, indent=1, ensure_ascii=False))

    print(f"\nWrote {len(final)} records to {OUT.relative_to(ROOT)} ({dupes} duplicates merged, {invalid} invalid dropped)")
    print("\nSource status:", json.dumps(status, indent=1))
    print("\nBy source:")
    for k, v in collections.Counter(c["source"] for c in final).most_common():
        print(f"  {k:15s} {v}")
    print("\nBy category:")
    for k, v in collections.Counter(c["category"] for c in final).most_common():
        print(f"  {k:15s} {v}")
    print("\nBy county:")
    for k, v in collections.Counter(c.get("county") or "(statewide/none)" for c in final).most_common():
        print(f"  {k:20s} {v}")


if __name__ == "__main__":
    main()
