import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";

const CATEGORY_COLORS = {
  international: "#75ba75",  
  independent: "#1565c0",
  government: "#ff6b01",
};

const ALERT_TTL_MS = 2 * 60 * 1000; // alert badge expires after 2 minutes

export default function NewsSidebar({ articles, displayLang, keywords, loading, newArticleIds }) {
  const [visibleIds, setVisibleIds] = useState(new Set());
  const prevIdsRef = useRef(new Set());

  // Track which articles are "new" for fade-in animation
  useEffect(() => {
    const currentIds = new Set(articles.map((a) => a.id));
    const brandNew = [...currentIds].filter((id) => !prevIdsRef.current.has(id));
    if (brandNew.length > 0) {
      setVisibleIds((prev) => {
        const next = new Set(prev);
        brandNew.forEach((id) => next.add(id));
        return next;
      });
    }
    prevIdsRef.current = currentIds;
  }, [articles]);

  const getTitle = (art) => {
    if (displayLang === "en" && art.titleEn) return art.titleEn;
    return art.title;
  };

  const getSummary = (art) => {
    if (displayLang === "en" && art.summaryEn) return art.summaryEn;
    return art.summary;
  };

  const matchesKeywords = (art) => {
    if (!keywords.length) return true;
    const text = `${art.title} ${art.summary} ${art.titleEn || ""} ${art.summaryEn || ""}`.toLowerCase();
    return keywords.some((k) => text.includes(k.toLowerCase()));
  };

  const isRecentAlert = (art) => {
    try {
      const age = Date.now() - new Date(art.pubDate).getTime();
      return age < ALERT_TTL_MS;
    } catch { return false; }
  };

  const highlight = (text) => {
    if (!text || !keywords.length) return text;
    const pattern = new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = text.split(pattern);
    return parts.map((part, i) =>
      pattern.test(part) ? (
        <mark key={i} style={{ background: "#f57f1740", color: "#f9a825", borderRadius: 2, padding: "0 2px" }}>
          {part}
        </mark>
      ) : part
    );
  };

  // Filter to only keyword-matching articles
  const filtered = articles.filter(matchesKeywords);

  if (loading) {
    return (
      <div style={{ padding: "20px 16px", color: "#444", fontFamily: "monospace", fontSize: 12 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{ height: 80, background: "#141414", borderRadius: 4, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ height: 14, background: "#141414", borderRadius: 2, width: "80%", marginBottom: 6 }} />
            <div style={{ height: 11, background: "#141414", borderRadius: 2, width: "60%" }} />
          </div>
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div style={{ padding: 20, color: "#444", fontSize: 11, fontFamily: "monospace", textAlign: "center", marginTop: 40 }}>
        {keywords.length > 0
          ? `No articles matching current keywords`
          : "No articles loaded"}
      </div>
    );
  }

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "0 0 20px" }}>
      {filtered.map((art, i) => {
        const isNew = newArticleIds?.has(art.id);
        const isAlert = isRecentAlert(art) && i === 0; // only mark the very latest as alert
        const title = getTitle(art);
        const summary = getSummary(art);
        const timeAgo = (() => {
          try { return formatDistanceToNow(parseISO(art.pubDate), { addSuffix: true }); }
          catch { return ""; }
        })();

        return (
          <article
            key={art.id || i}
            style={{
              borderBottom: "1px solid #1a1a1a",
              padding: "14px 16px",
              background: isAlert ? "rgba(245, 127, 23, 0.06)" : "transparent",
              borderLeft: isAlert ? "3px solid #f57f17" : "3px solid transparent",
              cursor: "pointer",
              animation: isNew ? "fadeSlideIn 0.4s ease forwards" : "none",
              opacity: isNew ? 0 : 1,
            }}
            onClick={() => window.open(art.link, "_blank")}
          >
            {art.thumbnail && (
              <div style={{ width: "100%", height: 90, marginBottom: 10, borderRadius: 4, overflow: "hidden", background: "#111" }}>
                <img src={art.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { e.target.parentNode.style.display = "none"; }} />
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{
                background: CATEGORY_COLORS[art.category] || "#424242", color: "#fff",
                fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
                padding: "1px 5px", borderRadius: 2, textTransform: "uppercase", fontWeight: 700,
              }}>
                {art.source}
              </span>
              {art.clusterSize > 1 && (
                <span style={{ color: "#555", fontSize: 9, fontFamily: "monospace" }}>+{art.clusterSize - 1}</span>
              )}
              {isAlert && (
                <span style={{ fontSize: 9, color: "#f9a825", animation: "blink 2s infinite" }}>● NEW</span>
              )}
              <span style={{ color: "#444", fontSize: 9, fontFamily: "monospace", marginLeft: "auto" }}>{timeAgo}</span>
            </div>

            <div style={{
              color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500, lineHeight: 1.4, marginBottom: 6,
            }}>
              {highlight(title)}
            </div>

            {summary && (
              <div style={{
                color: "#666", fontSize: 11, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif",
                display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {highlight(summary)}
              </div>
            )}

            {art.clusterSources?.length > 1 && (
              <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {art.clusterSources.slice(1).map((s) => (
                  <span key={s} style={{ color: "#444", fontSize: 9, fontFamily: "monospace", border: "1px solid #222", padding: "1px 4px", borderRadius: 2 }}>{s}</span>
                ))}
              </div>
            )}
          </article>
        );
      })}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
