"""Unit check for the Python ranker's Act today post-processing (app/pipeline.py), no API key needed."""
from types import SimpleNamespace as C

from app.pipeline import act_today_steps

KEEP = [
    C(name="BOSS", phone="(510) 649-1930", url="https://self-sufficiency.org/", source_url=None, address="1918 University Ave"),
    C(name="Clinic with no contact", phone=None, url=None, source_url=None, address=None),
    C(name="CalFresh (apply via GetCalFresh)", phone="(877) 847-3663", url="https://www.getcalfresh.org/", source_url=None, address=None),
]


def test_contacts_come_from_record_and_benefits_are_dropped():
    out = act_today_steps([
        {"title": "Call BOSS about a backup bed (510) 555-9999", "how": "call", "resource_index": 0, "bullets": ["a", "b", "c", "d"], "for_alumnus_title": "Call BOSS"},
        {"title": "Apply for CalFresh and Medi-Cal", "how": "apply_online", "resource_index": 2, "for_alumnus_title": "Apply"},
        {"title": "Visit the clinic", "how": "visit", "resource_index": 1, "for_alumnus_title": "Go to the clinic"},
    ], KEEP)
    assert [s.title for s in out] == ["Call BOSS about a backup bed", "Visit the clinic"]
    assert out[0].phone == "(510) 649-1930" and out[0].url == "https://self-sufficiency.org/"
    assert len(out[0].bullets) == 3
    assert out[1].missing_contact is True
    # the evals still read one line per step
    assert out[0].for_alumnus.startswith("Call BOSS")
