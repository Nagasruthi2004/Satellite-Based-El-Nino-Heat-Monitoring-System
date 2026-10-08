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
    "india": "(\"El Niño\" OR \"El Nino\" OR \"ENSO\") (India OR Indian OR monsoon OR IMD OR \"Tamil Nadu\" OR Delhi OR Mumbai OR rainfall OR drought)",
    "global": "(\"El Niño\" OR \"El Nino\" OR \"ENSO\") (global OR Pacific OR NOAA OR WMO OR Australia OR \"South America\" OR Peru OR international OR worldwide)",
    "climate": "(\"El Niño\" OR \"El Nino\" OR \"ENSO\") (\"climate change\" OR \"global warming\" OR \"ocean warming\" OR \"sea surface temperature\" OR \"record heat\" OR \"climate science\")",
    "impacts": "(\"El Niño\" OR \"El Nino\" OR \"ENSO\") (impact OR impacts OR heatwave OR drought OR flood OR floods OR agriculture OR crop OR crops OR fisheries OR \"water crisis\")"
}

CATEGORY_DISPLAY_NAMES = {
    "india": "In India",
    "global": "Global",
    "climate": "Climate",
    "impacts": "El Niño Impacts"
}

INDIA_PATTERNS = [
    r"\bindia\b", r"\bindian\b", r"\bindians\b", r"\bbharat\b", r"\bhindustan\b",
    r"\btamil\s*nadu\b", r"\bkerala\b", r"\bkarnataka\b", r"\bandhra(?:\s*pradesh)?\b",
    r"\btelangana\b", r"\bmaharashtra\b", r"\bgujarat\b", r"\brajasthan\b",
    r"\bpunjab\b", r"\bharyana\b", r"\buttar\s*pradesh\b", r"\bmadhya\s*pradesh\b",
    r"\bbihar\b", r"\b(?:west\s*)?bengal\b", r"\bodisha\b", r"\borissa\b",
    r"\bassam\b", r"\bjharkhand\b", r"\bchhattisgarh\b", r"\buttarakhand\b",
    r"\bhimachal(?:\s*pradesh)?\b", r"\bjammu\b", r"\bkashmir\b", r"\bladakh\b", r"\bgoa\b",
    r"\bdelhi\b", r"\bnew\s*delhi\b", r"\bmumbai\b", r"\bbombay\b", r"\bchennai\b",
    r"\bmadras\b", r"\bkolkata\b", r"\bcalcutta\b", r"\bbengaluru\b", r"\bbangalore\b",
    r"\bhyderabad\b", r"\bpune\b", r"\bahmedabad\b", r"\bjaipur\b", r"\blucknow\b",
    r"\bkanpur\b", r"\bnagpur\b", r"\bpatna\b", r"\bbhopal\b", r"\bcoimbatore\b",
    r"\bkochi\b", r"\bcochin\b", r"\bthiruvananthapuram\b", r"\bchandigarh\b",
    r"\bguwahati\b", r"\bbhubaneswar\b", r"\bvisakhapatnam\b", r"\bvizag\b",
    r"\bsurat\b", r"\bindore\b", r"\bvadodara\b", r"\bvaranasi\b", r"\bmysuru\b",
    r"\btrichy\b", r"\bsalem\b", r"\bmadurai\b",
    r"\bimd\b", r"\bindia\s*meteorological\s*department\b", r"\bskymet\b",
    r"\b(?:south-?west|north-?east|indian)\s*monsoon\b",
    r"\bmonsoon\b", r"\bkharif\b", r"\brabi\b",
    r"\bcauvery\b", r"\bganga\b", r"\byamuna\b", r"\bgodavari\b"
]

GLOBAL_EXPLICIT_FOREIGN = [
    r"\bpacific(?:\s*ocean)?\b", r"\btropical\s*pacific\b", r"\bequatorial\s*pacific\b",
    r"\bsouth\s*america\b", r"\blatin\s*america\b", r"\bperu(?:vian)?\b", r"\becuador\b",
    r"\bchile\b", r"\bcolombia\b", r"\bbrazil\b", r"\bargentina\b", r"\bbolivia\b",
    r"\baustralia\b", r"\bqueensland\b", r"\bnew\s*zealand\b",
    r"\bjapan\b", r"\btokyo\b", r"\bphilippines\b", r"\bindonesia\b", r"\bmalaysia\b",
    r"\bpapua\s*new\s*guinea\b", r"\bfiji\b", r"\bvietnam\b", r"\bthailand\b",
    r"\bafrica\b", r"\bkenya\b", r"\bsomalia\b", r"\bethiopia\b", r"\bzimbabwe\b",
    r"\bzambia\b", r"\bhorn\s*of\s*africa\b",
    r"\bunited\s*states\b", r"\busa\b", r"\bcalifornia\b", r"\bflorida\b", r"\btexas\b",
    r"\bnorth\s*america\b", r"\beurope\b", r"\bspain\b", r"\buk\b", r"\bbritain\b", r"\bcanada\b",
    r"\bnoaa\b", r"\bwmo\b", r"\bworld\s*meteorological\s*organization\b",
    r"\bbureau\s*of\s*meteorology\b", r"\bbom\b", r"\bcopernicus\b", r"\becmwf\b",
    r"\bclimate\s*prediction\s*center\b", r"\bcpc\b", r"\bjma\b", r"\bjapan\s*meteorological\s*agency\b"
]

GLOBAL_SCOPE = [
    r"\bworld(?:wide)?\b", r"\bplanet(?:ary)?\b", r"\binternational\b",
    r"\bhemisphere\b", r"\bacross\s+the\s+globe\b",
    r"\bglob(?:al|ally)\s+(?!warming|climate|temperature|boiling|heat|record)"
]

CLIMATE_PATTERNS = [
    r"\bclimate\s*change\b", r"\bglobal\s*warming\b", r"\bclimate\s*crisis\b",
    r"\bclimate\s*emergency\b", r"\bclimate\s*science\b", r"\bclimatolog",
    r"\bclimate\s*model(?:s|ing)?\b", r"\bclimate\s*scientist(?:s)?\b",
    r"\bclimate\s*research\b", r"\bclimate\s*report\b", r"\bclimate\s*trend(?:s)?\b",
    r"\bclimate\s*policy\b", r"\bclimate\s*target(?:s)?\b", r"\bclimate\s*action\b",
    r"\bipcc\b", r"\bparis\s*agreement\b", r"\bcop(?:2[89]|30)\b",
    r"\bgreenhouse\s*gas(?:es)?\b", r"\bcarbon\s*emission(?:s)?\b", r"\batmospheric\s*co2\b",
    r"\bocean\s*warming\b", r"\bocean\s*heat\s*content\b",
    r"\bsea\s*surface\s*temperature\b", r"\bsst\s*anomaly\b",
    r"\brecord\s*(?:warm|warmest|temperature|temperatures|heat)\b",
    r"\bhottest\s*(?:year|month|summer|record)\b",
    r"\btemperature\s*anomal(?:y|ies)\b", r"\bthermal\s*anomaly\b",
    r"\bmarine\s*heatwave\b", r"\bclimate\s*variability\b", r"\banthropogenic\b",
    r"\bclimate\s*shift\b", r"\benvironmental\s*research\b"
]

IMPACT_PATTERNS = [
    r"\bheat\s*wave(?:s)?\b", r"\bextreme\s*heat\b", r"\bsevere\s*heat\b",
    r"\bdrought(?:s)?\b", r"\bdry\s*spell(?:s)?\b", r"\bwater\s*cris(?:is|es)\b",
    r"\bwater\s*(?:shortage|scarcity)\b", r"\bdepleted\s*reservoir(?:s)?\b",
    r"\bflood(?:s|ing)?\b", r"\bflash\s*flood(?:s)?\b", r"\btorrential\s*rain(?:s)?\b",
    r"\brainfall\b", r"\bdeficit\s*rain(?:fall)?\b", r"\bfailed\s*monsoon\b",
    r"\bmonsoon\s*(?:deficit|changes?|shift|delay|failure|variabilit|disrupt)\b",
    r"\bwildfire(?:s)?\b", r"\bbushfire(?:s)?\b", r"\bcrop(?:s)?\b", r"\bharvest\b",
    r"\bfarmer(?:s)?\b", r"\bfood\s*security\b", r"\bcrop\s*yield(?:s)?\b",
    r"\bfood\s*inflation\b", r"\bcoral\s*bleaching\b", r"\bfisher(?:y|ies)\b",
    r"\bpower\s*(?:crisis|shortage|outage|grid)\b", r"\beconomic\s*(?:impact|toll|loss|losses)\b",
    r"\bcost\s*of\s*living\b", r"\bhealth\s*impact(?:s)?\b", r"\bdisaster(?:s)?\b",
    r"\binfrastructure\b", r"\bshortage\b", r"\bimpact(?:s|ed|ing)?\b",
    r"\beffect(?:s)?\b", r"\bdisrupt(?:s|ed|ing|ion)?\b"
]


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


def _classify_article_categories(title: str, description: str, source: str = "") -> list:
    """
    Classifies an article into zero, one, or more categories:
    ['india', 'global', 'climate', 'impacts'] based on strict topic & location rules.
    """
    text = f"{title} {description}".lower()

    # 1. India detection
    is_india = any(re.search(p, text) for p in INDIA_PATTERNS)

    # 2. Global detection: Has international or global scope, and not an India-only local report
    has_foreign = any(re.search(p, text) for p in GLOBAL_EXPLICIT_FOREIGN)
    has_global_scope = any(re.search(p, text) for p in GLOBAL_SCOPE)
    is_global = (has_foreign or has_global_scope) and (not is_india or has_foreign)

    # 3. Climate detection: Primary focus on climate change, global warming, or ocean heat
    is_climate = any(re.search(p, text) for p in CLIMATE_PATTERNS)

    # 4. El Niño Impacts detection: Specific reported consequence (heatwave, drought, flood, crops, etc.)
    is_impact = any(re.search(p, text) for p in IMPACT_PATTERNS) or (
        "rainfall" in text and any(w in text for w in ["disrupt", "affect", "impact", "deficit", "excess", "drop", "failure"])
    )

    cats = []
    if is_india:
        cats.append("india")
    if is_global:
        cats.append("global")
    if is_climate:
        cats.append("climate")
    if is_impact:
        cats.append("impacts")

    return sorted(cats)


def _get_display_category(categories: list, requested_cat: str = "") -> str:
    """Returns a primary user-friendly display name for the article."""
    if requested_cat and requested_cat in categories:
        return CATEGORY_DISPLAY_NAMES.get(requested_cat, "Climate")
    if categories:
        return CATEGORY_DISPLAY_NAMES.get(categories[0], "Climate")
    return "Climate"


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


def fetch_elnino_news(category: str = "india", force_refresh: bool = False, limit: int = 15):
    """
    Fetches latest El Niño articles from live RSS feeds and strictly classifies them into:
    'india', 'global', 'climate', 'impacts' (or 'all').
    Returns: dict with status, category, count, last_updated, and articles list.
    """
    cat_key = (category or "india").lower().strip()
    if cat_key not in CATEGORY_QUERIES:
        cat_key = "india"

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

        # Filter out irrelevant non-meteorological articles (e.g. sports or entertainment)
        if not _is_relevant_el_nino_article(clean_title, clean_desc):
            continue

        # Classify categories
        article_categories = _classify_article_categories(clean_title, clean_desc, source_name)

        # STRICT FILTERING: When a specific category is requested (e.g. india, global, climate, impacts),
        # only include articles that genuinely match that category!
        if cat_key != "all" and cat_key not in article_categories:
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

        display_cat = _get_display_category(article_categories, cat_key)
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
            "category": display_cat,
            "categories": article_categories,
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
