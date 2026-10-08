import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from elnino_news import (
    fetch_elnino_news,
    _is_relevant_el_nino_article,
    _normalize_title_for_dedup,
    _classify_article_categories,
)


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


def test_user_category_classification_examples():
    """
    Directly tests the specific examples from the user prompt:
    1. Article mentions Chennai + El Niño rainfall -> In India + El Niño Impacts
    2. Article about Japan El Niño effects -> Global + El Niño Impacts
    3. Article about global warming without an El Niño impact -> Climate
    4. Article about ENSO conditions affecting Pacific countries -> Global
    5. Article about Indian monsoon changes caused by El Niño -> In India + El Niño Impacts
    """
    # 1. Chennai + El Niño rainfall -> In India + El Niño Impacts
    cats1 = _classify_article_categories(
        "Chennai braces for altered rainfall patterns under El Niño",
        "IMD tracks seasonal precipitation across Tamil Nadu"
    )
    assert "india" in cats1, f"Expected 'india' in {cats1}"
    assert "impacts" in cats1, f"Expected 'impacts' in {cats1}"
    assert "global" not in cats1, f"'global' should not be in India local news: {cats1}"

    # 2. Japan El Niño effects -> Global + El Niño Impacts
    cats2 = _classify_article_categories(
        "Japan observes significant El Niño effects on regional climate",
        "JMA reports on temperature anomalies and ocean shifts"
    )
    assert "global" in cats2, f"Expected 'global' in {cats2}"
    assert "impacts" in cats2, f"Expected 'impacts' in {cats2}"
    assert "india" not in cats2, f"'india' should not be in Japan news: {cats2}"

    # 3. Global warming without an El Niño impact -> Climate
    cats3 = _classify_article_categories(
        "Global warming accelerates ocean heat content: Climate study",
        "Climate change scientists report on long-term temperature trends and atmospheric CO2"
    )
    assert "climate" in cats3, f"Expected 'climate' in {cats3}"
    assert "impacts" not in cats3, f"'impacts' should not be present without concrete damage/impact: {cats3}"

    # 4. ENSO conditions affecting Pacific countries -> Global
    cats4 = _classify_article_categories(
        "ENSO conditions develop across Pacific countries",
        "Meteorologists track sea surface temperature transitions in equatorial Pacific"
    )
    assert "global" in cats4, f"Expected 'global' in {cats4}"
    assert "india" not in cats4, f"'india' should not be present: {cats4}"

    # 5. Indian monsoon changes caused by El Niño -> In India + El Niño Impacts
    cats5 = _classify_article_categories(
        "Indian monsoon changes caused by El Niño raise agricultural concerns",
        "Kharif crop season faces rainfall variations across Indian states"
    )
    assert "india" in cats5, f"Expected 'india' in {cats5}"
    assert "impacts" in cats5, f"Expected 'impacts' in {cats5}"
    assert "global" not in cats5, f"'global' should not be present: {cats5}"


def test_strict_category_isolation():
    # India-only article should NOT be categorized as Global
    cats = _classify_article_categories("Delhi heatwave breaks 10-year record under El Nino influence", "IMD issues red alert for northern India")
    assert "india" in cats
    assert "global" not in cats

    # Foreign article should NOT be categorized as India
    cats_foreign = _classify_article_categories("Peru fisheries disrupted by warm equatorial Pacific waters", "NOAA reports on coastal El Nino event")
    assert "global" in cats_foreign
    assert "india" not in cats_foreign


def test_fetch_elnino_news_all_four_categories():
    categories = ["india", "global", "climate", "impacts"]
    for cat in categories:
        res = fetch_elnino_news(category=cat, limit=10)
        assert res["status"] == "success"
        assert res["category"] == cat
        # Ensure that every returned article has the requested category in its categories list!
        for article in res["articles"]:
            assert "categories" in article, f"Article missing categories: {article.get('title')}"
            assert cat in article["categories"], (
                f"Article '{article['title']}' returned in '{cat}' category but has categories: {article['categories']}"
            )


def test_flask_endpoint():
    client = app.test_client()
    # Default without query param should be 'india'
    res_default = client.get("/elnino-news")
    assert res_default.status_code == 200
    data_default = res_default.get_json()
    assert data_default["status"] == "success"
    assert data_default["category"] == "india"

    # All 4 required categories
    for cat in ["india", "global", "climate", "impacts"]:
        res = client.get(f"/elnino-news?category={cat}")
        assert res.status_code == 200
        data = res.get_json()
        assert data["status"] == "success"
        assert data["category"] == cat
        for art in data["articles"]:
            assert cat in art["categories"]
            assert art["url"].startswith("http")
            assert len(art["title"]) > 0


def test_flask_endpoint_refresh():
    client = app.test_client()
    res = client.get("/elnino-news?category=india&refresh=true")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert data["count"] >= 0


if __name__ == "__main__":
    test_relevance_filter()
    print("test_relevance_filter: PASS")
    test_deduplication()
    print("test_deduplication: PASS")
    test_user_category_classification_examples()
    print("test_user_category_classification_examples: PASS")
    test_strict_category_isolation()
    print("test_strict_category_isolation: PASS")
    test_fetch_elnino_news_all_four_categories()
    print("test_fetch_elnino_news_all_four_categories: PASS")
    test_flask_endpoint()
    print("test_flask_endpoint: PASS")
    test_flask_endpoint_refresh()
    print("test_flask_endpoint_refresh: PASS")
    print("ALL TEST CASES PASSED SUCCESSFULLY!")

