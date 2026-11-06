"""Shared data contracts for the reentry resource agents.

Every module (data snapshot, tools, agents, UI, evals) exchanges these shapes.
All alumni profiles are FICTIONAL. Only public resource data is sent to outside APIs.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Category = Literal[
    "housing", "health", "food_benefits", "jobs", "legal_id", "family", "clothing"
]
FinderName = Literal["housing", "health", "food_benefits", "jobs", "legal_id"]
Verdict = Literal["likely", "worth_applying", "not_eligible"]


class Supervision(BaseModel):
    type: Literal["parole", "probation", "pretrial", "none", "unknown"] = "unknown"
    curfew: Optional[str] = None  # e.g. "10pm-6am"
    gps: bool = False
    county_restriction: Optional[str] = None  # county they must stay in
    notes: Optional[str] = None


class Profile(BaseModel):
    id: Optional[str] = None
    display_name: str = "Alumnus"  # fictional first name for the demo
    city: str
    county: str
    zip: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    days_since_release: Optional[int] = None
    supervision: Supervision = Field(default_factory=Supervision)
    documents_held: list[str] = Field(default_factory=list)  # "state_id", "ssn_card", "birth_certificate"
    housing_status: Literal[
        "unhoused", "shelter", "transitional", "family_or_friends", "own_place", "unknown"
    ] = "unknown"
    household_size: int = 1
    monthly_income: Optional[int] = None  # USD
    gender: Optional[str] = None
    lgbtq: Optional[bool] = None
    children: Optional[str] = None  # e.g. "2 kids in foster care"
    offense_categories: list[str] = Field(default_factory=list)  # coded: drug, violent, property, sex_registration, dui, other
    insurance: Optional[str] = None
    goals: list[str] = Field(default_factory=list)
    barriers: list[str] = Field(default_factory=list)
    notes: Optional[str] = None


class Need(BaseModel):
    category: Category
    urgency: Literal["today", "this_week", "this_month"]
    why: str


class Brief(BaseModel):
    finder: FinderName
    focus: str  # what this finder should look for, in plain words
    constraints: list[str] = Field(default_factory=list)  # e.g. "must be open past 6pm", "Alameda County only"


class OrchestratorPlan(BaseModel):
    needs: list[Need]
    briefs: list[Brief]


class Candidate(BaseModel):
    name: str
    category: Category
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    phone: Optional[str] = None
    url: Optional[str] = None
    hours: Optional[str] = None
    who_it_serves: Optional[str] = None
    intake_requirements: Optional[str] = None
    cost: Optional[str] = None
    source: str  # snapshot | findtreatment | hud | fdic | careeronestop | hrsa | 211 | web | tlm
    source_url: Optional[str] = None
    tlm_network: bool = False
    distance_miles: Optional[float] = None


class JudgedCandidate(Candidate):
    verdict: Verdict
    reason: str
    confirm_question: Optional[str] = None  # set when verdict == worth_applying
    rule_cited: Optional[str] = None
    rule_url: Optional[str] = None


class Recommendation(BaseModel):
    candidate: JudgedCandidate
    why_it_fits: str
    what_to_bring: list[str] = Field(default_factory=list)


class NeedSection(BaseModel):
    need: Need
    recommendations: list[Recommendation]


class ActStep(BaseModel):
    step: str
    for_alumnus: str = ""  # the same step written to the person ("you"); the case manager reviews it before sharing
    resource_name: Optional[str] = None
    what_to_bring: list[str] = Field(default_factory=list)


class Plan(BaseModel):
    profile: Profile
    sections: list[NeedSection]
    act_today: list[ActStep]
    excluded: list[JudgedCandidate] = Field(default_factory=list)
    stats: dict = Field(default_factory=dict)  # programs_checked, sources_searched, est_minutes_saved, seconds
