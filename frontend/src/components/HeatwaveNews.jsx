import { useState, useEffect } from 'react';

const GNEWS_KEY    = import.meta.env.VITE_GNEWS_API_KEY;
const NEWSDATA_KEY = import.meta.env.VITE_NEWSDATA_API_KEY;

const STATIC_FALLBACK = [
  {
    title: 'India Heatwave Advisory — Stay Safe',
    source: 'IMD',
    publishedAt: null,
    description: 'India Meteorological Department issues heatwave alerts and safety guidelines for affected regions.',
    url: 'https://mausam.imd.gov.in/',
    image: null,
  },
  {
    title: 'National Heat Action Plan — NDMA Guidelines',
    source: 'NDMA',
    publishedAt: null,
    description: 'Avoid outdoor activities between 11 AM and 3 PM. Drink water regularly and wear light clothing.',
    url: 'https://ndma.gov.in/Natural-Hazards/Heat-Wave',
    image: null,
  },
  {
    title: 'WHO Heat and Health — Global Guidance',
    source: 'WHO',
    publishedAt: null,
    description: 'World Health Organization guidance on protecting health during extreme heat events.',
    url: 'https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health',
    image: null,
  },
];

function formatDate(iso) {
  if (!iso) return 'Advisory';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function classifyGNewsError(status) {
  if (status === 403) return 'GNews: API key is invalid, expired, or the free-tier quota is exhausted.';
  if (status === 401) return 'GNews: API key is not configured correctly.';
  if (status === 429) return 'GNews: Rate limit reached. Try again later.';
  return `GNews: Unexpected error (${status}).`;
}

const HEAT_KEYWORDS = [
  'heat', 'heatwave', 'temperature', 'weather',
  'climate', 'summer', 'hot', 'imd', 'forecast',
];

function isRelevant(article) {
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
  return HEAT_KEYWORDS.some((kw) => text.includes(kw));
}

function filterAndCap(items) {
  return items.filter(isRelevant).slice(0, 5);
}

async function fetchGNews(query) {
  if (!GNEWS_KEY) throw new Error('GNews API key is not configured.');
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=10&apikey=${GNEWS_KEY}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(classifyGNewsError(res.status));
  const data = await res.json();
  return filterAndCap((data.articles || []).map((a) => ({
    title:       a.title,
    source:      a.source?.name || 'GNews',
    publishedAt: a.publishedAt,
    description: a.description,
    url:         a.url,
    image:       a.image,
  })));
}

async function fetchNewsData(query) {
  if (!NEWSDATA_KEY) throw new Error('NewsData API key is not configured.');
  const url = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(query)}&language=en`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`NewsData.io error: ${res.status}`);
  const data = await res.json();
  return filterAndCap((data.results || []).map((a) => ({
    title:       a.title,
    source:      a.source_id || 'NewsData',
    publishedAt: a.pubDate,
    description: a.description,
    url:         a.link,
    image:       a.image_url,
  })));
}

function HeatwaveNews({ weather }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [notice, setNotice]     = useState('');
  const [label, setLabel]       = useState('');

  const city = weather?.city || null;

  useEffect(() => {
    setLoading(true);
    setNotice('');
    setArticles([]);

    const cityQueries = city
      ? [`${city} heatwave`, `${city} extreme heat`, `${city} heat`]
      : [];
    const fallbackQueries = ['India heatwave', 'global heatwave'];
    const warnings = [];

    // Try a fetch function across an ordered list of queries,
    // returning the first non-empty result.
    const tryQueries = async (fetchFn, queries) => {
      for (const q of queries) {
        const items = await fetchFn(q);
        if (items.length > 0) return items;
      }
      return [];
    };

    const tryFetch = async () => {
      // ── Layer 1: GNews ──────────────────────────────────────────
      if (GNEWS_KEY) {
        try {
          const allQueries = [...cityQueries, ...fallbackQueries];
          const items = await tryQueries(fetchGNews, allQueries);
          if (items.length > 0) {
            setArticles(items);
            setLabel(city || 'India');
            return;
          }
        } catch (e) {
          warnings.push(e.message);
        }
      } else {
        warnings.push('GNews API key is not configured.');
      }

      // ── Layer 2: NewsData.io ────────────────────────────────────
      if (NEWSDATA_KEY) {
        try {
          const allQueries = [...cityQueries, ...fallbackQueries];
          const items = await tryQueries(fetchNewsData, allQueries);
          if (items.length > 0) {
            setArticles(items);
            setLabel(city || 'India');
            return;
          }
        } catch (e) {
          warnings.push(e.message);
        }
      } else {
        warnings.push('NewsData API key is not configured.');
      }

      // ── Layer 3: Static fallback ────────────────────────────────
      setArticles(STATIC_FALLBACK);
      setLabel('Advisory');
      setNotice(warnings.join(' | '));
    };

    tryFetch().finally(() => setLoading(false));
  }, [city]);

  return (
    <div className="card">
      <h2>📰 Live Heatwave News {label ? `— ${label}` : ''}</h2>

      {loading && (
        <p className="hospitals-hint">Fetching latest heatwave news…</p>
      )}

      {!loading && notice && (
        <div className="news-notice">{notice} Showing advisory content.</div>
      )}

      {!loading && articles.length > 0 && (
        <div className="news-grid">
          {articles.map((article, i) => (
            <div key={i} className="news-card">
              {article.image ? (
                <img
                  className="news-image"
                  src={article.image}
                  alt={article.title}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="news-image-placeholder">📰</div>
              )}
              <div className="news-body">
                <div className="news-meta">
                  <span className="news-source">{article.source}</span>
                  <span className="news-date">{formatDate(article.publishedAt)}</span>
                </div>
                <div className="news-title">{article.title}</div>
                {article.description && (
                  <div className="news-description">{article.description}</div>
                )}
                <a
                  className="news-read-more"
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read More →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HeatwaveNews;
