import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import TopBar from "../components/TopBar";
import NewsSidebar from "../components/NewsSidebar";
import SocialPanel from "../components/SocialPanel";
import { CHANNELS, DEFAULT_KEYWORDS, REFRESH_INTERVAL_MS } from "../lib/config";

// HLS players must be client-side only
const VideoTile = dynamic(() => import("../components/VideoTile"), { ssr: false });

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [audioChannel, setAudioChannel] = useState("m1"); // which channel has audio
  const [displayLang, setDisplayLang] = useState("en");
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [userInteracted, setUserInteracted] = useState(false);

  const handleStart = () => {
    setUserInteracted(true);
    // Trigger play on all videos after interaction
    document.querySelectorAll('video').forEach(v => {
      v.muted = true;
      v.play().catch(() => {});
    });
  };
  const [sidebarTab, setSidebarTab] = useState("news"); // news | social
  const intervalRef = useRef(null);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news");
      if (!res.ok) return;
      const data = await res.json();
      setArticles(data.articles || []);
      setLastFetch(data.fetchedAt);
    } catch (e) {
      console.error("News fetch failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    intervalRef.current = setInterval(fetchNews, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchNews]);

  const alertCount = articles.filter((art) => {
    if (!keywords.length) return false;
    const text = `${art.title} ${art.summary} ${art.titleEn || ""} ${art.titleSr || ""}`.toLowerCase();
    return keywords.some((k) => text.includes(k.toLowerCase()));
  }).length;

  // Active channels (those with stream URLs configured, up to 4)
  const activeChannels = CHANNELS.filter((c) => c.stream).slice(0, 4);
  const allChannels = CHANNELS.slice(0, 4);

  // Grid layout based on number of streams
  const gridTemplate = allChannels.length <= 2
    ? "1fr 1fr"
    : "1fr 1fr";

  return (
    <>
      <Head>
        <title>HU/ELECT 2026 — OSINT Platform</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&family=DM+Sans:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#080808", color: "#e0e0e0" }}>
        {!userInteracted && (
          <div
            onClick={handleStart}
            style={{
              position: "fixed", inset: 0, zIndex: 999,
              background: "rgba(8,8,8,0.92)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <div style={{
              border: "1px solid #222", borderRadius: 8,
              padding: "32px 48px", textAlign: "center",
            }}>
              <div style={{
                color: "#e53935", fontFamily: "'DM Mono', monospace",
                fontWeight: 700, fontSize: 13, letterSpacing: "0.12em",
                textTransform: "uppercase", marginBottom: 16,
              }}>
                HU/ELECT 2026 — OSINT
              </div>
              <div style={{
                color: "#e0e0e0", fontFamily: "'DM Sans', sans-serif",
                fontSize: 15, marginBottom: 24,
              }}>
                Click anywhere to start all streams
              </div>
              <div style={{
                background: "#e53935", color: "#fff",
                fontFamily: "'DM Mono', monospace", fontSize: 11,
                letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "10px 24px", borderRadius: 4, display: "inline-block",
              }}>
                ▶ Start
              </div>
            </div>
          </div>
        )}

          keywords={keywords}
          setKeywords={setKeywords}
          displayLang={displayLang}
          setDisplayLang={setDisplayLang}
          lastFetch={lastFetch}
          alertCount={alertCount}
        />

        <main style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          {/* ── LEFT: Video grid ── */}
          <div
            style={{
              flex: "1 1 0",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: 4,
              padding: 4,
              background: "#050505",
              minWidth: 0,
            }}
          >
            {allChannels.map((channel, i) => (
              <VideoTile
                key={channel.id}
                channel={channel}
                index={i}
                isAudioActive={audioChannel === channel.id}
                onActivateAudio={setAudioChannel}
              />
            ))}
          </div>

          {/* ── RIGHT: Sidebar ── */}
          <div
            style={{
              width: 320,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid #1a1a1a",
              background: "#0a0a0a",
              overflow: "hidden",
            }}
          >
            {/* Tab switcher */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #1a1a1a",
                flexShrink: 0,
              }}
            >
              {["news", "social"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  style={{
                    flex: 1,
                    background: sidebarTab === tab ? "#111" : "transparent",
                    border: "none",
                    borderBottom: sidebarTab === tab ? "2px solid #e53935" : "2px solid transparent",
                    color: sidebarTab === tab ? "#e0e0e0" : "#444",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    padding: "10px 0",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {tab === "news" ? `News ${articles.length > 0 ? `(${articles.length})` : ""}` : "Social"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
              {sidebarTab === "news" ? (
                <NewsSidebar
                  articles={articles}
                  displayLang={displayLang}
                  keywords={keywords}
                  loading={loading}
                />
              ) : (
                <SocialPanel visible={sidebarTab === "social"} />
              )}
            </div>

            {/* Footer: manual refresh */}
            <div
              style={{
                borderTop: "1px solid #1a1a1a",
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "#333", fontSize: 9, fontFamily: "monospace" }}>
                auto-refresh 90s
              </span>
              <button
                onClick={fetchNews}
                style={{
                  background: "transparent",
                  border: "1px solid #222",
                  color: "#555",
                  fontFamily: "monospace",
                  fontSize: 9,
                  padding: "3px 8px",
                  borderRadius: 3,
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                ↻ refresh now
              </button>
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080808; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes alertPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
