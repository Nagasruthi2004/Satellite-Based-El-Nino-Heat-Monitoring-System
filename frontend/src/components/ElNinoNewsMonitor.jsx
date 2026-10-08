import { useState, useEffect, useCallback, useRef } from "react";

const FILTER_TABS = [
  { id: "india", label: "In India", icon: "🇮🇳" },
  { id: "global", label: "Global", icon: "🌍" },
  { id: "climate", label: "Climate", icon: "🌡️" },
  { id: "impacts", label: "El Niño Impacts", icon: "⚠️" },
];

const CATEGORY_DISPLAY_MAP = {
  india: "In India",
  global: "Global",
  climate: "Climate",
  impacts: "El Niño Impacts",
};

function ElNinoNewsMonitor() {
  const [activeFilter, setActiveFilter] = useState("india");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchNews = useCallback(async (category = "india", isRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        category,
        ...(isRefresh ? { refresh: "true" } : {}),
      });

      const response = await fetch(`http://127.0.0.1:5000/elnino-news?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch El Niño news`);
      }

      const data = await response.json();
      setArticles(Array.isArray(data.articles) ? data.articles : []);
      setLastUpdated(data.last_updated_human || new Date().toLocaleTimeString());
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Error fetching El Niño news:", err);
      setError(err.message || "Unable to load El Niño news. Please check backend connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch news automatically when module is loaded or activeFilter changes
  useEffect(() => {
    let isMounted = true;
    const loadNews = async () => {
      await Promise.resolve();
      if (isMounted) {
        fetchNews(activeFilter, false);
      }
    };
    loadNews();
    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [activeFilter, fetchNews]);

  const handleRefresh = () => {
    fetchNews(activeFilter, true);
  };

  // Strict category filtering: each section contains ONLY news relevant to that category
  const visibleArticles = articles.filter((item) => {
    if (Array.isArray(item.categories) && item.categories.length > 0) {
      return item.categories.includes(activeFilter);
    }
    return !item.category || item.category.toLowerCase().includes(activeFilter);
  });

  return (
    <div className="elnino-news-container">
      {/* ── HEADER CARD ── */}
      <div className="card elnino-news-header-card">
        <div className="elnino-news-header-top">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "22px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📰</span> El Niño News Monitor
              </h2>
              <span className="live-dot" title="Live automatic feed" />
              <span className="elnino-news-live-tag">Live Feed</span>
            </div>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "14px" }}>
              Real-time climate, monsoon, and ocean warming developments tracked automatically from verified meteorological and news agencies.
            </p>
          </div>

          <div className="elnino-news-actions">
            {lastUpdated && (
              <div className="elnino-news-last-updated" title="Feed last fetched time">
                <span className="elnino-news-clock-icon">🕒</span>
                <span>Last updated: <strong>{lastUpdated}</strong></span>
              </div>
            )}
            <button
              type="button"
              className="elnino-news-refresh-btn"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              title="Fetch latest El Niño news now"
            >
              <span className={refreshing ? "spin-icon" : ""}>🔄</span>
              <span>{refreshing ? "Refreshing..." : "Refresh News"}</span>
            </button>
          </div>
        </div>

        {/* ── FILTER TABS ── */}
        <div className="elnino-news-filters" role="tablist" aria-label="News Category Filters">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`elnino-news-filter-tab ${isActive ? "active" : ""}`}
                onClick={() => setActiveFilter(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      {loading ? (
        <div className="card elnino-news-status-card">
          <div className="elnino-news-spinner" />
          <h3 style={{ margin: "16px 0 6px", fontSize: "17px" }}>Fetching latest El Niño news...</h3>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>
            Scanning meteorological agencies, NOAA, WMO, and climate news feeds.
          </p>
        </div>
      ) : error ? (
        <div className="card elnino-news-status-card elnino-news-error-card">
          <span style={{ fontSize: "36px" }}>⚠️</span>
          <h3 style={{ margin: "12px 0 6px", fontSize: "17px", color: "var(--danger)" }}>
            Failed to Load El Niño News
          </h3>
          <p style={{ margin: "0 0 16px", color: "var(--text-muted)", fontSize: "14px", maxWidth: "480px" }}>
            {error}
          </p>
          <button
            type="button"
            className="elnino-news-retry-btn"
            onClick={() => fetchNews(activeFilter, true)}
          >
            <span>🔄</span> Try Again
          </button>
        </div>
      ) : visibleArticles.length === 0 ? (
        <div className="card elnino-news-status-card">
          <span style={{ fontSize: "36px" }}>📭</span>
          <h3 style={{ margin: "12px 0 6px", fontSize: "17px" }}>No Relevant Articles Found</h3>
          <p style={{ margin: "0 0 16px", color: "var(--text-muted)", fontSize: "14px" }}>
            No relevant news available for this category.
          </p>
          <button
            type="button"
            className="elnino-news-retry-btn"
            onClick={handleRefresh}
          >
            <span>🔄</span> Refresh Category
          </button>
        </div>
      ) : (
        <>
          <div className="elnino-news-count-banner">
            <span>Showing <strong>{visibleArticles.length}</strong> verified {CATEGORY_DISPLAY_MAP[activeFilter] || "El Niño"} articles</span>
            <span className="elnino-news-quality-note">⚡ Real-time automated verification • No hardcoded news</span>
          </div>

          <div className="elnino-news-grid">
            {visibleArticles.map((item, index) => {
              const isOfficial = item.source_type === "Official Agency";
              const isReputed = item.source_type === "Reputed Source";

              return (
                <article key={item.id || index} className="card elnino-news-card">
                  <div className="elnino-news-card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      {(Array.isArray(item.categories) && item.categories.length > 0
                        ? item.categories
                        : [activeFilter]
                      ).map((catId) => (
                        <span key={catId} className="elnino-news-category-badge">
                          {CATEGORY_DISPLAY_MAP[catId] || item.category || catId}
                        </span>
                      ))}
                      <span
                        className={`elnino-news-source-tag ${
                          isOfficial ? "official" : isReputed ? "reputed" : ""
                        }`}
                        title={`Source: ${item.source} (${item.source_type})`}
                      >
                        {isOfficial ? "🏛️ " : isReputed ? "📰 " : "📌 "}
                        {item.source}
                      </span>
                    </div>
                    <span className="elnino-news-time-ago" title={item.published_date}>
                      {item.published_time_ago}
                    </span>
                  </div>

                  <h3 className="elnino-news-article-title">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open full article in new tab"
                    >
                      {item.title}
                    </a>
                  </h3>

                  <p className="elnino-news-article-desc">{item.description}</p>

                  <div className="elnino-news-card-footer">
                    <div className="elnino-news-date-meta">
                      <span>📅</span>
                      <span>{item.published_date}</span>
                    </div>

                    <a
                      className="elnino-news-read-btn"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Read full article at ${item.source}`}
                    >
                      <span>Read Full Article</span>
                      <span className="arrow-icon">↗</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default ElNinoNewsMonitor;
