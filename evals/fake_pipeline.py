"""Deterministic stand-in for app.pipeline.run_pipeline, used to test the eval harness (--fake).

Same signature: `async def run_pipeline(request: dict, emit) -> Plan`. Emits the event types
documented in events.md and returns a plausible Plan built from a small hard-coded catalog.
"""
from __future__ import annotations

import asyncio
import random

from app.schemas import (
    ActStep,
    Candidate,
    JudgedCandidate,
    Need,
    NeedSection,
    Plan,
    Profile,
    Recommendation,
)

GA_NAMES = {
    "Los Angeles": ("LA County General Relief", "https://dpss.lacounty.gov/en/cash/gr.html"),
    "Alameda": ("Alameda County General Assistance", "https://www.alamedacountysocialservices.org/our-services/Work-and-Money/General-Assistance/index"),
    "San Francisco": ("SF County Adult Assistance Programs (CAAP)", "https://www.sf.gov/apply-cash-assistance-caap"),
    "Sacramento": ("Sacramento County General Assistance", "https://dhs.saccounty.gov/PRI/Pages/General-Assistance/GA-Home.aspx"),
    "Fresno": ("Fresno County General Relief", "https://www.fresnocountyca.gov/Departments/Social-Services"),
    "San Diego": ("San Diego County General Relief", "https://www.sandiegocounty.gov/content/sdc/hhsa/programs/ssp/general_relief.html"),
    "Riverside": ("Riverside County General Assistance", "https://rivcodpss.org/"),
    "Kern": ("Kern County General Assistance", "https://www.kcdhs.org/"),
}

# (name, category, description, url, source, statewide)
CATALOG = [
    ("CalFresh (apply on BenefitsCal)", "food_benefits", "Monthly food benefits on an EBT card. A drug felony does not disqualify you in California.", "https://www.cdss.ca.gov/calfresh", "snapshot", True),
    ("Medi-Cal (apply on BenefitsCal)", "health", "Free health coverage for low-income Californians, including substance use treatment.", "https://www.dhcs.ca.gov/services/medi-cal", "snapshot", True),
    ("DMV Cal-ID card (reduced fee)", "legal_id", "California identification card; reduced-fee or no-fee ID available.", "https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/identification-id-cards/", "snapshot", True),
    ("Social Security card replacement (SSA)", "legal_id", "Replace a lost Social Security card online or at a local SSA office.", "https://www.ssa.gov/number-card/replace-card", "snapshot", True),
    ("America's Job Center of California (AJCC)", "jobs", "Free job search help, training vouchers, forklift and warehouse certifications.", "https://www.caljobs.ca.gov/", "careeronestop", True),
    ("SAMHSA treatment locator - substance use treatment", "health", "Find licensed substance use treatment and recovery programs near you.", "https://findtreatment.gov/", "findtreatment", True),
    ("Clean Slate record clearance clinic (1203.4 expungement)", "legal_id", "Free help with expungement, Prop 47 reductions, and record relief.", "https://selfhelp.courts.ca.gov/clean-your-record", "snapshot", True),
    ("Coordinated Entry access point (call 211)", "housing", "Entry point for shelter, navigation centers, and transitional housing.", "https://www.211ca.org/", "211", False),
    ("Reentry transitional housing program", "housing", "Transitional housing for people leaving prison; violent records screened case-by-case.", "https://www.cdcr.ca.gov/rehabilitative-programs/", "web", False),
    ("Truck driving CDL training (WIOA-funded)", "jobs", "Class A CDL training through WIOA vouchers.", "https://www.caljobs.ca.gov/", "careeronestop", True),
    ("Child Welfare reunification parenting classes", "family", "Parenting and family reunification support for parents with an open case.", "https://www.cdss.ca.gov/inforesources/child-welfare-programs", "snapshot", False),
    ("CalWORKs", "food_benefits", "Cash aid and childcare for families with children.", "https://www.cdss.ca.gov/calworks", "snapshot", True),
    ("Project Rebound / Rising Scholars college program", "jobs", "College support for formerly incarcerated students.", "https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/Educational-Services-and-Support/Student-Service/What-we-do/Rising-Scholars-Network", "web", True),
]


async def run_pipeline(request: dict, emit) -> Plan:
    profile = Profile.model_validate(request["profile"])
    rng = random.Random(profile.id or profile.city)
    county = profile.county

    await emit({"type": "agent_start", "agent": "intake", "message": f"Reading situation for {profile.display_name}"})
    await emit({"type": "agent_start", "agent": "orchestrator", "message": "Deciding what to look for"})

    finders = ["housing", "health", "food_benefits", "jobs", "legal_id"]
    for f in finders:
        await emit({"type": "agent_start", "agent": f, "message": f"Searching {f} in {county} County"})
        await emit({"type": "tool_call", "agent": f, "tool": "web_search", "message": f"{f} programs near {profile.city} https://www.211ca.org/"})
        await asyncio.sleep(rng.uniform(0.01, 0.05))
        await emit({"type": "found", "agent": f, "message": f"Found {f} options", "count": 3})

    ga_name, ga_url = GA_NAMES.get(county, (f"{county} County General Assistance", "https://www.211ca.org/"))
    rows = CATALOG + [(ga_name, "food_benefits", "County cash aid for adults without children.", ga_url, "snapshot", False)]

    sections: dict[str, list[Recommendation]] = {}
    for name, cat, desc, url, source, statewide in rows:
        verdict = "likely"
        confirm = None
        if ("transitional" in name.lower() and "violent" in profile.offense_categories) or "CDL" in name:
            verdict = "worth_applying"
            confirm = "Has your parole/probation officer approved this?"
        cand = JudgedCandidate(
            name=name,
            category=cat,
            description=desc,
            city=profile.city if not statewide else None,
            county=county if not statewide else None,
            url=url,
            source=source,
            source_url=url,
            verdict=verdict,
            reason="No written rule excludes this person." if verdict == "likely" else "Screened case-by-case.",
            confirm_question=confirm,
        )
        sections.setdefault(cat, []).append(
            Recommendation(candidate=cand, why_it_fits=f"Fits {profile.display_name}'s situation in {county} County.", what_to_bring=["ID if you have it", "release papers"])
        )

    excluded = [
        JudgedCandidate(
            name="Veterans transitional housing (VA GPD)",
            category="housing",
            description="Transitional housing for veterans.",
            url="https://www.va.gov/homeless/gpd.asp",
            source="hud",
            source_url="https://www.va.gov/homeless/gpd.asp",
            verdict="not_eligible",
            reason="Program rules require veteran status; profile does not show military service.",
            rule_cited="Grant and Per Diem program serves homeless veterans only (38 CFR 61).",
            rule_url="https://www.va.gov/homeless/gpd.asp",
        ),
        JudgedCandidate(
            name="Downtown men's shelter",
            category="housing",
            source="211",
            verdict="not_eligible",
            reason="Unclear whether there are beds; info missing.",
        ),
    ]

    await emit({"type": "verdict", "agent": "eligibility", "message": "Judged all candidates", "count": len(rows) + len(excluded)})
    await emit({"type": "stats", "programs_checked": len(rows) + len(excluded), "sources_searched": 6})

    plan = Plan(
        profile=profile,
        sections=[
            NeedSection(need=Need(category=cat, urgency="this_week", why=f"{cat} need"), recommendations=recs)
            for cat, recs in sections.items()
        ],
        act_today=[ActStep(step="Apply for CalFresh and Medi-Cal on BenefitsCal", resource_name="CalFresh (apply on BenefitsCal)", what_to_bring=["ID", "proof of income"])],
        excluded=excluded,
        stats={"programs_checked": len(rows) + len(excluded), "sources_searched": 6},
    )
    await emit({"type": "done", "plan": plan.model_dump()})
    return plan
