import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { TWITTER_ACCOUNTS } from "../lib/config";

function timeAgo(dateStr) {
  try { return formatDistanceToNow(parseISO(dateStr), { addSuffix: true }); }
  catch { return ""; }
}

function TweetCard({ tweet, account, displayLang }) {
  const text = displayLang === "en" && tweet.textEn ? tweet.textEn : tweet.text;

  return (
    <article
      onClick={() => window.open(tweet.url, "_blank")}
      style={{
        borderBottom: "1px solid #1a1a1a", padding: "12px 14px", cursor: "pointer",
        borderLeft: `3px solid ${account.color}`, background: "transparent", transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#0e0e0e")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ background: "#000", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 2, fontFamily: "'DM Mono', monospace" }}>𝕏</span>
        <span style={{ color: account.color, fontSize: 10, fontFamily: "'DM Mono', monospace" }}>@{account.handle}</span>
        <span style={{ marginLeft: "auto", color: "#444", fontSize: 9, fontFamily: "monospace" }}>{timeAgo(tweet.createdAt)}</span>
      </div>
      {tweet.image && (
        <div style={{ width: "100%", height: 100, marginBottom: 8, borderRadius: 4, overflow: "hidden", background: "#111" }}>
          <img src={tweet.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { e.target.parentNode.style.display = "none"; }} />
        </div>
      )}
      {text && (
        <div style={{ color: "#ccc", fontSize: 12, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, wordBreak: "break-word" }}>
          {text}
        </div>
      )}
    </article>
  );
}

function AccountFeed({ account, displayLang }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/tweets?id=${account.id}`);
      const json = await res.json();
      if (!res.ok || json.error) setError(json.error || "Failed to load");
      else setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [account.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Sticky header with collapse toggle */}
      <div
        style={{
          padding: "10px 14px 8px", borderBottom: "1px solid #1a1a1a",
          display: "flex", alignItems: "center", gap: 8,
          background: "#0c0c0c", position: "sticky", top: 0, zIndex: 1,
          cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        {account.profileImage && (
          <img src={account.profileImage} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        )}
        <span style={{ color: account.color, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{account.label}</span>
        <span style={{ color: "#444", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>@{account.handle}</span>
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
                  <div style={{ height: 11, background: "#141414", borderRadius: 2, width: "75%", animation: "pulse 1.5s ease-in-out infinite" }} />
                </div>
              ))}
            </div>
          )}
          {error && !loading && (
            <div style={{ padding: "12px 14px", color: "#555", fontSize: 10, fontFamily: "monospace" }}>
              ⚠ {error}
              <button onClick={load} style={{ marginLeft: 8, background: "transparent", border: "1px solid #222", color: "#555", fontSize: 9, fontFamily: "monospace", padding: "2px 6px", borderRadius: 3, cursor: "pointer" }}>↻ retry</button>
            </div>
          )}
          {!loading && !error && data?.tweets?.length === 0 && (
            <div style={{ padding: "12px 14px", color: "#444", fontSize: 10, fontFamily: "monospace" }}>No tweets found</div>
          )}
          {!loading && !error && data?.tweets?.map((tweet) => (
            <TweetCard key={tweet.id} tweet={tweet} account={account} displayLang={displayLang} />
          ))}
        </>
      )}
    </div>
  );
}

export default function SocialPanel({ visible, displayLang }) {
  if (!visible) return null;
  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      <div style={{ color: "#555", fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 14px", borderBottom: "1px solid #1a1a1a" }}>
        𝕏 Twitter / X
      </div>
      {TWITTER_ACCOUNTS.map((account) => (
        <AccountFeed key={account.id} account={account} displayLang={displayLang} />
      ))}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}
