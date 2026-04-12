import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import TopBar from "../components/TopBar";
import NewsSidebar from "../components/NewsSidebar";
import SocialPanel from "../components/SocialPanel";
import FacebookPanel from "../components/FacebookPanel";
import { CHANNELS, DEFAULT_KEYWORDS, REFRESH_INTERVAL_MS } from "../lib/config";
import { fetchClientFeeds } from "../lib/fetchClientFeeds";

const VideoTile = dynamic(() => import("../components/VideoTile"), { ssr: false });

const TABS = [
  { id: "news",     label: (n) => n > 0 ? `News (${n})` : "News" },
  { id: "social",   label: () => "𝕏" },
  { id: "facebook", label: () => "Facebook" },
];

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [newArticleIds, setNewArticleIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [audioChannel, setAudioChannel] = useState("m1");
  const [displayLang, setDisplayLang] = useState("en");
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [userInteracted, setUserInteracted] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("news");

  // Global volume/mute state
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  const prevArticleIdsRef = useRef(new Set());
  const intervalRef = useRef(null);

  const handleStart = () => {
    setUserInteracted(true);
    document.querySelectorAll("video").forEach((v) => {
      v.muted = true;
      v.play().catch(() => {});
    });
  };

  // Apply volume/mute ONLY to the currently active audio tile
  useEffect(() => {
    const video = document.querySelector(`#tile-${audioChannel} video`);
    if (!video) return;
    video.muted = muted;
    video.volume = volume;
  }, [volume, muted, audioChannel]);

  const fetchNews = useCallback(async () => {
  try {
    // Phase 1: server fetch (NYT, Politico — no Cloudflare)
    // Returns articles + list of client-side feeds to fetch
    const res = await fetch("/api/news?t=" + Date.now());
    if (!res.ok) return;
    const data = await res.json();

    // Phase 2: browser fetches Cloudflare-protected feeds directly
    const clientArticles = await fetchClientFeeds(data.clientFeeds || []);

    // Phase 3: send client articles back to server for dedup + translation
    let finalData = data;
    if (clientArticles.length > 0) {
      const mergeRes = await fetch("/api/news?t=" + Date.now(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientArticles }),
      });
      if (mergeRes.ok) {
        finalData = await mergeRes.json();
      }
    }

    const incoming = finalData.articles || [];
    const incomingIds = new Set(incoming.map((a) => a.id));
    const brandNew = new Set([...incomingIds].filter((id) => !prevArticleIdsRef.current.has(id)));

    setArticles(incoming);
    setLastFetch(finalData.fetchedAt);
    if (brandNew.size > 0) setNewArticleIds(brandNew);
    prevArticleIdsRef.current = incomingIds;
    setTimeout(() => setNewArticleIds(new Set()), 10000);
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

  const alertCount = newArticleIds.size;
  const allChannels = CHANNELS.slice(0, 4);

  return (
    <>
      <Head>
        <title>HU/ELECTS 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#080808", color: "#e0e0e0" }}>
        {!userInteracted && (
          <div onClick={handleStart} style={{
            position: "fixed", inset: 0, zIndex: 999, background: "rgba(8,8,8,0.92)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <div style={{ border: "1px solid #222", borderRadius: 8, padding: "32px 48px", textAlign: "center" }}>
              <div style={{ color: "#e53935", fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
                HU/ELECTS 2026
              </div>
              <div style={{ color: "#e0e0e0", fontFamily: "'DM Sans', sans-serif", fontSize: 15, marginBottom: 24 }}>
                Click anywhere to start all streams
              </div>
              <div style={{ background: "#e53935", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", padding: "10px 24px", borderRadius: 4, display: "inline-block" }}>
                ▶ Start
              </div>
            </div>
          </div>
        )}

        <TopBar
          keywords={keywords} setKeywords={setKeywords}
          displayLang={displayLang} setDisplayLang={setDisplayLang}
          lastFetch={lastFetch} alertCount={alertCount}
        />

        <main style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          {/* Video grid */}
          <div style={{
            flex: "1 1 0", display: "grid",
            gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
            gap: 4, padding: 4, background: "#050505", minWidth: 0,
          }}>
            {allChannels.map((channel, i) => (
              <VideoTile key={channel.id} channel={channel} index={i}
                isAudioActive={audioChannel === channel.id}
                onActivateAudio={setAudioChannel}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div style={{
            width: 320, flexShrink: 0, display: "flex", flexDirection: "column",
            borderLeft: "1px solid #1a1a1a", background: "#0a0a0a", overflow: "hidden",
          }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setSidebarTab(tab.id)} style={{
                  flex: 1, background: sidebarTab === tab.id ? "#111" : "transparent", border: "none",
                  borderBottom: sidebarTab === tab.id ? "2px solid #e53935" : "2px solid transparent",
                  color: sidebarTab === tab.id ? "#e0e0e0" : "#444",
                  fontFamily: "'DM Mono', monospace", fontSize: 10,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "10px 0", cursor: "pointer", transition: "all 0.15s",
                }}>
                  {tab.label(articles.length)}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div style={{ flex: 1, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
              {sidebarTab === "news" && (
                <NewsSidebar articles={articles} displayLang={displayLang}
                  keywords={keywords} loading={loading} newArticleIds={newArticleIds} />
              )}
              {sidebarTab === "social" && <SocialPanel visible={true} displayLang={displayLang} />}
              {sidebarTab === "facebook" && <FacebookPanel visible={true} displayLang={displayLang} />}
            </div>

            {/* Footer: volume + mute + refresh */}
            <div style={{
              borderTop: "1px solid #1a1a1a", padding: "8px 14px",
              display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
            }}>
              {/* Mute button */}
              <button
                onClick={() => setMuted((m) => !m)}
                title={muted ? "Unmute" : "Mute"}
                style={{
                  background: "transparent", border: "1px solid #222",
                  color: muted ? "#e53935" : "#555",
                  fontFamily: "monospace", fontSize: 11,
                  padding: "3px 7px", borderRadius: 3, cursor: "pointer",
                  flexShrink: 0, lineHeight: 1,
                }}
              >
                {muted ? "🔇" : "🔊"}
              </button>

              {/* Volume slider */}
              <input
                type="range"
                min={0} max={1} step={0.02}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: "#e53935", cursor: "pointer", height: 4 }}
              />

              {/* Refresh */}
              <button
                onClick={fetchNews}
                style={{
                  background: "transparent", border: "1px solid #222", color: "#555",
                  fontFamily: "monospace", fontSize: 9, padding: "3px 8px",
                  borderRadius: 3, cursor: "pointer", letterSpacing: "0.06em",
                  textTransform: "uppercase", flexShrink: 0,
                }}
              >↻</button>
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
        input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-runnable-track { height: 3px; background: #222; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #e53935; margin-top: -4.5px; cursor: pointer; }
        input[type=range]::-moz-range-track { height: 3px; background: #222; border-radius: 2px; }
        input[type=range]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #e53935; border: none; cursor: pointer; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes alertPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
    </>
  );
}
