import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from elnino_news import fetch_elnino_news, _is_relevant_el_nino_article, _normalize_title_for_dedup


def test_relevance_filter():
    # Genuinely relevant
    assert _is_relevant_el_nino_article("El Nino triggers severe heatwave in central India", "IMD issues warning on rising temperatures")
    assert _is_relevant_el_nino_article("WMO updates ENSO outlook: Pacific sea surface warming continues", "Global weather patterns expected to shift")

    # Irrelevant sports or entertainment using El Nino nickname
    assert not _is_relevant_el_nino_article("Soccer striker Fernando Torres (El Nino) signs contract with FC club", "The footballer scored two goals in the match")
    assert not _is_relevant_el_nino_article("Taco restaurant El Nino opens new branch", "Enjoy fresh burritos and tacos tonight")


def test_deduplication():
    t1 = "El Nino threatens Indian monsoon 2026 - Reuters"
    t2 = "El Nino threatens Indian monsoon 2026 - The Hindu"
    assert _normalize_title_for_dedup(t1) == _normalize_title_for_dedup(t2)


def test_fetch_elnino_news_module():
    res = fetch_elnino_news(category="all", limit=5)
    assert res["status"] == "success"
    assert res["count"] > 0
    assert len(res["articles"]) > 0

    art = res["articles"][0]
    assert "title" in art
    assert "source" in art
    assert "url" in art
    assert "published_at" in art
    assert "description" in art


def test_flask_endpoint():
    client = app.test_client()
    for cat in ["all", "india", "global", "climate", "impacts"]:
        res = client.get(f"/elnino-news?category={cat}")
        assert res.status_code == 200
        data = res.get_json()
        assert data["status"] == "success"
        assert len(data["articles"]) > 0
        art = data["articles"][0]
        assert art["url"].startswith("http")
        assert len(art["title"]) > 0


def test_flask_endpoint_refresh():
    client = app.test_client()
    res = client.get("/elnino-news?category=india&refresh=true")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert data["count"] > 0


if __name__ == "__main__":
    test_relevance_filter()
    print("test_relevance_filter: PASS")
    test_deduplication()
    print("test_deduplication: PASS")
    test_fetch_elnino_news_module()
    print("test_fetch_elnino_news_module: PASS")
    test_flask_endpoint()
    print("test_flask_endpoint: PASS")
    test_flask_endpoint_refresh()
    print("test_flask_endpoint_refresh: PASS")
    print("ALL 5 TEST CASES PASSED SUCCESSFULLY!")
