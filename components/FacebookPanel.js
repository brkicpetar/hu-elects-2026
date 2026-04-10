import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { FACEBOOK_PAGES } from "../lib/config";

function timeAgo(dateStr) {
  try { return formatDistanceToNow(parseISO(dateStr), { addSuffix: true }); }
  catch { return ""; }
}

function PostCard({ post, color, displayLang }) {
  const text = displayLang === "en" && post.textEn ? post.textEn : post.text;

  return (
    <article
      onClick={() => window.open(post.url, "_blank")}
      style={{
        borderBottom: "1px solid #1a1a1a", padding: "12px 14px", cursor: "pointer",
        borderLeft: `3px solid ${color}`, background: "transparent", transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#0e0e0e")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ marginLeft: "auto", color: "#444", fontSize: 9, fontFamily: "monospace" }}>{timeAgo(post.createdAt)}</span>
      </div>
      {post.image && (
        <div style={{ width: "100%", height: 90, marginBottom: 8, borderRadius: 4, overflow: "hidden", background: "#111" }}>
          <img src={post.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { e.target.parentNode.style.display = "none"; }} />
        </div>
      )}
      {text && (
        <div style={{ color: "#ccc", fontSize: 12, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {text}
        </div>
      )}
      {post.likes !== undefined && (
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {[{ icon: "♥", val: post.likes }, { icon: "💬", val: post.comments }, { icon: "↺", val: post.shares }].map(({ icon, val }) => (
            val !== undefined && (
              <span key={icon} style={{ color: "#444", fontSize: 9, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 10 }}>{icon}</span>{(val || 0).toLocaleString()}
              </span>
            )
          ))}
        </div>
      )}
    </article>
  );
}

function PageFeed({ page, displayLang }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/facebook?id=${page.id}`);
      const json = await res.json();
      if (!res.ok || json.error) setError(json.error || "Failed to load");
      else setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [page.id]);

  useEffect(() => { load(); }, [load]);

  const color = page.color;

  return (
    <div>
      {/* Sticky header with logo + collapse */}
      <div
        style={{
          padding: "8px 14px", borderBottom: "1px solid #1a1a1a",
          display: "flex", alignItems: "center", gap: 8,
          background: "#0c0c0c", position: "sticky", top: 0, zIndex: 1,
          cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        {/* Party logo */}
        <img
          src={page.logoUrl}
          alt={page.label}
          style={{ height: 22, width: "auto", objectFit: "contain", flexShrink: 0 }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <span style={{ color, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
          {page.label}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {!loading && (
            <button onClick={(e) => { e.stopPropagation(); load(); }} style={{
              background: "transparent", border: "1px solid #222", color: "#555",
              fontSize: 9, fontFamily: "monospace", padding: "2px 6px", borderRadius: 3, cursor: "pointer",
            }}>↻</button>
          )}
          <span style={{ color: "#444", fontSize: 11, lineHeight: 1 }}>{collapsed ? "▸" : "▾"}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {loading && (
            <div style={{ padding: "14px 14px" }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ height: 90, background: "#141414", borderRadius: 4, marginBottom: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
                  <div style={{ height: 11, background: "#141414", borderRadius: 2, width: "80%", marginBottom: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
                  <div style={{ height: 10, background: "#141414", borderRadius: 2, width: "55%", animation: "pulse 1.5s ease-in-out infinite" }} />
                </div>
              ))}
            </div>
          )}
          {error && !loading && (
            <div style={{ padding: "12px 14px" }}>
              <div style={{ color: "#555", fontSize: 10, fontFamily: "monospace", lineHeight: 1.6, marginBottom: 8 }}>
                {error.includes("not configured") ? "⚠ RSS URL not set in config.js" : `⚠ ${error}`}
              </div>
              {!error.includes("not configured") && (
                <button onClick={load} style={{ background: "transparent", border: "1px solid #222", color: "#555", fontSize: 9, fontFamily: "monospace", padding: "3px 8px", borderRadius: 3, cursor: "pointer" }}>↻ retry</button>
              )}
            </div>
          )}
          {!loading && !error && data?.posts?.length === 0 && (
            <div style={{ padding: "12px 14px", color: "#444", fontSize: 10, fontFamily: "monospace" }}>No posts found</div>
          )}
          {!loading && !error && data?.posts?.map((post) => (
            <PostCard key={post.id} post={post} color={color} displayLang={displayLang} />
          ))}
        </>
      )}
    </div>
  );
}

export default function FacebookPanel({ visible, displayLang }) {
  if (!visible) return null;
  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      <div style={{ color: "#555", fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 14px", borderBottom: "1px solid #1a1a1a" }}>
        Facebook pages
      </div>
      {FACEBOOK_PAGES.map((page) => (
        <PageFeed key={page.id} page={page} displayLang={displayLang} />
      ))}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}
