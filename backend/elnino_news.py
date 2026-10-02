"""
elnino_news.py
Fetches, filters, deduplicates, and caches real-world El Niño and ENSO news.
Uses reliable public news RSS feeds (Google News RSS & meteorological feeds).
"""

import logging
import re
import time
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import requests

logger = logging.getLogger(__name__)

# Cache duration in seconds (10 minutes)
CACHE_TTL_SECONDS = 600

# In-memory news cache keyed by category
_NEWS_CACHE = {}

# Official and reputed sources for tagging and relevance
OFFICIAL_SOURCES = {
    "noaa", "wmo", "world meteorological organization", "nasa",
    "imd", "india meteorological department", "pib", "ministry of earth sciences",
    "copernicus", "ecmwf", "bureau of meteorology", "cpc"
}

REPUTED_SOURCES = {
    "reuters", "the hindu", "the indian express", "indian express",
    "times of india", "down to earth", "bbc", "bbc news", "al jazeera",
    "bloomberg", "the guardian", "ap news", "associated press",
    "hindustan times", "business standard", "livemint", "mint",
    "nature", "science", "scientific american", "dpa", "afp", "ani",
    "cnbc", "financial express", "ndtv", "the wire", "scroll.in"
}

# Positive relevance keywords to ensure news is genuinely about El Niño / ENSO climate
METEOROLOGICAL_KEYWORDS = {
    "enso", "el nino", "el niño", "la nina", "la niña",
    "climate", "weather", "monsoon", "ocean", "pacific",
    "sea surface", "temperature", "sst", "heat", "heatwave",
    "drought", "rainfall", "rain", "meteorol", "meteorology",
    "noaa", "wmo", "imd", "cyclone", "warming", "southern oscillation",
    "oni", "forecast", "atmosphere", "atmospheric", "tropical pacific",
    "marine", "agriculture", "harvest", "crop", "flood", "dry spell"
}

# Irrelevant topic indicators (sports athletes, celebrities, restaurants, etc.)
IRRELEVANT_KEYWORDS = {
    "fc", "football", "soccer", "striker", "midfielder", "boxer", "boxing",
    "nba", "basketball", "album", "song", "rapper", "movie", "actor",
    "actress", "taco", "burrito", "restaurant menu", "nightclub"
}

CATEGORY_QUERIES = {
    "all": "(\"El Niño\" OR \"El Nino\" OR \"ENSO\") (weather OR climate OR ocean OR monsoon OR temperature)",
    "india": "(\"El Niño\" OR \"El Nino\" OR \"ENSO\") (India OR monsoon OR IMD OR \"Indian Ocean\" OR drought OR rainfall)",
    "global": "(\"El Niño\" OR \"El Nino\" OR \"ENSO\") (global OR world OR NOAA OR WMO OR Pacific OR international)",
    "climate": "(\"El Niño\" OR \"El Nino\" OR \"ENSO\") (\"climate change\" OR \"global warming\" OR \"ocean warming\" OR temperature)",
    "impacts": "(\"El Niño\" OR \"El Nino\" OR \"ENSO\") (impact OR heatwave OR drought OR rainfall OR agriculture OR flood)"
}


def _clean_html(text: str) -> str:
    """Removes HTML markup and collapses extra whitespace."""
    if not text:
        return ""
    # Strip HTML tags
    clean = re.sub(r"<[^>]+>", " ", text)
    # Unescape common HTML entities
    clean = clean.replace("&quot;", "\"").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&#39;", "'").replace("&nbsp;", " ")
    return " ".join(clean.split()).strip()


def _normalize_title_for_dedup(title: str) -> str:
    """Normalizes title string to detect duplicates across different news sources."""
    if not title:
        return ""
    lowered = title.lower()
    # Strip source suffix if present (e.g. '... - Reuters')
    if " - " in lowered:
        lowered = lowered.rpartition(" - ")[0]
    # Keep only alphanumeric characters
    return re.sub(r"[^a-z0-9]", "", lowered)


def _is_relevant_el_nino_article(title: str, description: str) -> bool:
    """
    Ensures the article is genuinely about El Niño / ENSO and meteorology,
    filtering out unrelated content (e.g. soccer, athletes, entertainment).
    """
    combined = f"{title} {description}".lower()

    # Must contain El Niño or ENSO reference
    has_el_nino_keyword = any(k in combined for k in ["el nino", "el niño", "enso", "la nina", "la niña", "southern oscillation"])
    if not has_el_nino_keyword:
        return False

    # Check for irrelevant keywords (sports, entertainment) unless strongly meteorological
    has_irrelevant = any(re.search(rf"\b{re.escape(k)}\b", combined) for k in IRRELEVANT_KEYWORDS)
    if has_irrelevant:
        # If sports/entertainment keywords are present, verify if there is strong meteorological evidence
        meteo_count = sum(1 for k in METEOROLOGICAL_KEYWORDS if k in combined)
        if meteo_count < 3:
            return False

    # Must contain at least one meteorological/climate context keyword
    has_meteo = any(k in combined for k in METEOROLOGICAL_KEYWORDS)
    return has_meteo


def _categorize_article(title: str, description: str, requested_category: str) -> str:
    """Categorizes the article into India, Climate, Impacts, or Global."""
    text = f"{title} {description}".lower()

    if any(k in text for k in ["india", "monsoon", "imd", "delhi", "tamil nadu", "bengal", "kerala", "mumbai"]):
        return "India"
    if any(k in text for k in ["heatwave", "drought", "rainfall", "flood", "impact", "agriculture", "crop", "water crisis", "economy"]):
        return "El Niño Impacts"
    if any(k in text for k in ["climate change", "global warming", "carbon", "paris agreement", "ocean warming"]):
        return "Climate"
    return "Global"


def _classify_source(source_name: str) -> str:
    """Assigns a source badge type (Official Agency, Reputed Source, or Verified News)."""
    lowered = (source_name or "").lower().strip()
    if any(s in lowered for s in OFFICIAL_SOURCES):
        return "Official Agency"
    if any(s in lowered for s in REPUTED_SOURCES):
        return "Reputed Source"
    return "Verified News"


def _format_time_ago(dt: datetime) -> str:
    """Calculates human-readable relative time (e.g., '2 hours ago')."""
    if not dt:
        return "Recent"
    now = datetime.now(timezone.utc)
    diff = now - dt
    total_seconds = max(0, int(diff.total_seconds()))

    if total_seconds < 60:
        return "Just now"
    minutes = total_seconds // 60
    if minutes < 60:
        return f"{minutes} min ago" if minutes == 1 else f"{minutes} mins ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour ago" if hours == 1 else f"{hours} hours ago"
    days = hours // 24
    if days < 7:
        return f"{days} day ago" if days == 1 else f"{days} days ago"
    return dt.strftime("%d %b %Y")


def fetch_elnino_news(category: str = "all", force_refresh: bool = False, limit: int = 15):
    """
    Fetches latest El Niño articles from live RSS feeds.
    Returns: dict with status, category, count, last_updated, and articles list.
    """
    cat_key = (category or "all").lower().strip()
    if cat_key not in CATEGORY_QUERIES:
        cat_key = "all"

    # Check cache first if not force_refresh
    now = time.time()
    cached_entry = _NEWS_CACHE.get(cat_key)
    if not force_refresh and cached_entry and (now - cached_entry["cached_at"] < CACHE_TTL_SECONDS):
        logger.info("Serving El Niño news from in-memory cache for category: %s", cat_key)
        return cached_entry["data"]

    search_query = CATEGORY_QUERIES[cat_key]
    encoded_query = urllib.parse.quote(search_query)

    # Use Google News RSS (India edition for regional precision while catching global wires)
    rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
    }

    logger.info("Fetching live El Niño news from RSS for category: %s", cat_key)
    try:
        response = requests.get(rss_url, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as fetch_err:
        logger.warning("Primary RSS fetch failed (%s). Checking if cached data exists...", fetch_err)
        if cached_entry:
            return cached_entry["data"]
        raise RuntimeError(f"Unable to fetch live news at this time: {fetch_err}")

    try:
        root = ET.fromstring(response.content)
    except Exception as parse_err:
        logger.error("Failed to parse RSS XML: %s", parse_err)
        if cached_entry:
            return cached_entry["data"]
        raise RuntimeError(f"Failed to parse news feed XML: {parse_err}")

    raw_items = root.findall(".//item")
    logger.info("Found %d raw RSS items for %s", len(raw_items), cat_key)

    seen_titles = set()
    articles = []

    for item in raw_items:
        raw_title = (item.find("title").text if item.find("title") is not None else "") or ""
        link = (item.find("link").text if item.find("link") is not None else "") or ""
        pub_date_str = (item.find("pubDate").text if item.find("pubDate") is not None else "") or ""
        desc_elem = item.find("description")
        raw_desc = (desc_elem.text if desc_elem is not None else "") or ""
        source_elem = item.find("source")

        # Parse source name
        if source_elem is not None and source_elem.text:
            source_name = source_elem.text.strip()
        elif " - " in raw_title:
            source_name = raw_title.rpartition(" - ")[2].strip()
        else:
            source_name = "News Network"

        # Clean title by removing trailing source suffix if repeated
        clean_title = raw_title
        if " - " in clean_title:
            candidate_title = clean_title.rpartition(" - ")[0].strip()
            if len(candidate_title) > 15:
                clean_title = candidate_title

        # Clean description
        clean_desc = _clean_html(raw_desc)
        # Often Google News RSS description just repeats the title with links; provide clean fallback
        if not clean_desc or clean_desc.lower() == clean_title.lower():
            clean_desc = f"Latest meteorological and climate report regarding El Niño conditions and trends from {source_name}."

        # Filter out irrelevant articles
        if not _is_relevant_el_nino_article(clean_title, clean_desc):
            continue

        # Deduplicate
        norm_title = _normalize_title_for_dedup(clean_title)
        if not norm_title or norm_title in seen_titles:
            continue
        seen_titles.add(norm_title)

        # Parse publication date
        dt = None
        if pub_date_str:
            try:
                dt = parsedate_to_datetime(pub_date_str)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
            except Exception:
                dt = None

        item_timestamp = dt.timestamp() if dt else 0
        pub_iso = dt.isoformat() if dt else datetime.now(timezone.utc).isoformat()
        pub_date_formatted = dt.strftime("%d %b %Y, %I:%M %p") if dt else "Recent"
        time_ago = _format_time_ago(dt)

        article_cat = _categorize_article(clean_title, clean_desc, cat_key)
        source_badge = _classify_source(source_name)

        articles.append({
            "id": norm_title[:40],
            "title": clean_title,
            "source": source_name,
            "source_type": source_badge,
            "published_at": pub_iso,
            "published_date": pub_date_formatted,
            "published_time_ago": time_ago,
            "timestamp": item_timestamp,
            "description": clean_desc,
            "url": link,
            "category": article_cat,
        })

    # Sort latest first (newest timestamp)
    articles.sort(key=lambda x: x["timestamp"], reverse=True)

    # Slice to desired limit
    final_articles = articles[:limit]

    now_dt = datetime.now(timezone.utc)
    result_data = {
        "status": "success",
        "category": cat_key,
        "count": len(final_articles),
        "last_updated": now_dt.isoformat(),
        "last_updated_human": now_dt.strftime("%d %b %Y, %I:%M %p UTC"),
        "articles": final_articles,
    }

    # Save to in-memory cache
    _NEWS_CACHE[cat_key] = {
        "cached_at": now,
        "data": result_data,
    }

    return result_data
