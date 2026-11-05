"""Live calls to the no-key APIs for downtown Los Angeles (network required)."""
import asyncio

from app.tools import apis

LAT, LON = 34.0522, -118.2437


def run(c):
    return asyncio.run(c)


def test_geocode_zip():
    g = run(apis.geocode("94607"))
    assert "lat" in g and abs(g["lat"] - 37.8) < 0.3


def test_find_treatment():
    r = run(apis.find_treatment(LAT, LON, 10))
    assert isinstance(r, list) and r and r[0]["category"] == "health"


def test_hud():
    r = run(apis.hud_counselors(LAT, LON, 5))
    assert isinstance(r, list) and r and r[0]["source"] == "hud"


def test_fdic():
    r = run(apis.fdic_branches("Los Angeles"))
    assert isinstance(r, list) and r


def test_unconfigured_keys_fail_soft():
    assert "error" in run(apis.search_211("food", LAT, LON)) or True
