import { useEffect, useRef, useState } from "react";

const isHLS = (url) => url.includes(".m3u8") || url.includes("m3u8");

export default function VideoTile({ channel, isAudioActive, onActivateAudio }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!channel.stream || !videoRef.current) {
      setStatus("idle");
      return;
    }

    setStatus("loading");
    let destroyed = false;
    const video = videoRef.current;

    const loadStream = async () => {
      const url = channel.stream;

      if (isHLS(url)) {
        // ── HLS stream ──
        const Hls = (await import("hls.js")).default;
        if (destroyed) return;

        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
          playerRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!destroyed) { setStatus("playing"); video.play().catch(() => {}); }
          });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal && !destroyed) setStatus("error");
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.addEventListener("loadedmetadata", () => {
            if (!destroyed) { setStatus("playing"); video.play().catch(() => {}); }
          });
        } else {
          setStatus("error");
        }

      } else {
        // ── Raw MPEG-TS stream via mpegts.js ──
        const mpegts = (await import("mpegts.js")).default;
        if (destroyed) return;

        if (!mpegts.isSupported()) {
          console.error("mpegts.js not supported in this browser");
          setStatus("error");
          return;
        }

        const player = mpegts.createPlayer(
          {
            type: "mpegts",
            isLive: true,
            url: url,
            hasAudio: true,
            hasVideo: true,
          },
          {
            enableWorker: true,
            enableStashBuffer: false,
            stashInitialSize: 128,
            liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 8,
            liveBufferLatencyMinRemain: 2,
            lazyLoadMaxDuration: 0,
            seekType: "range",
          }
        );

        playerRef.current = player;
        player.attachMediaElement(video);
        player.load();

        // mpegts.js for live streams — start playing as soon as
        // the browser has enough data, don't wait for MEDIA_INFO
        const onCanPlay = () => {
          if (!destroyed) {
            setStatus("playing");
            video.play().catch(() => {});
          }
        };

        const onError = (errorType, errorDetail, errorInfo) => {
          console.error("mpegts error:", errorType, errorDetail, errorInfo);
          if (!destroyed) setStatus("error");
        };

        video.addEventListener("canplay", onCanPlay, { once: true });
        player.on(mpegts.Events.ERROR, onError);

        // Fallback: if canplay fires via mpegts events
        player.on(mpegts.Events.MEDIA_INFO, () => {
          console.log("mpegts MEDIA_INFO received");
        });

        // Store cleanup refs
        playerRef.current._onCanPlay = onCanPlay;
        playerRef.current._onError = onError;
        playerRef.current._video = video;
        playerRef.current._mpegts = mpegts;
      }
    };

    loadStream();

    return () => {
      destroyed = true;
      if (playerRef.current) {
        try {
          const p = playerRef.current;
          if (p._video && p._onCanPlay) {
            p._video.removeEventListener("canplay", p._onCanPlay);
          }
          if (p.off && p._onError && p._mpegts) {
            p.off(p._mpegts.Events.ERROR, p._onError);
          }
          if (typeof p.destroy === "function") p.destroy();
          else if (typeof p.stopLoad === "function") {
            p.stopLoad();
            p.detachMedia();
          }
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [channel.stream]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !isAudioActive;
  }, [isAudioActive]);

  const toggleFullscreen = () => {
    const tile = videoRef.current?.closest(".video-tile");
    if (!document.fullscreenElement) tile?.requestFullscreen();
    else document.exitFullscreen();
  };

  return (
    <div
      className="video-tile"
      style={{
        position: "relative", background: "#0a0a0a", borderRadius: "6px",
        overflow: "hidden",
        border: isAudioActive ? `2px solid ${channel.color}` : "2px solid #1a1a1a",
        transition: "border-color 0.2s", cursor: "pointer", aspectRatio: "16/9",
      }}
      onClick={() => onActivateAudio(channel.id)}
    >
      <video ref={videoRef} muted={!isAudioActive} playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />

      <div style={{
        position: "absolute", top: 8, left: 8, background: channel.color, color: "#fff",
        fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 11,
        letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 3, textTransform: "uppercase",
      }}>
        {channel.name}
      </div>

      {isAudioActive && (
        <div style={{
          position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 4,
          background: "rgba(0,0,0,0.7)", padding: "3px 7px", borderRadius: 3,
          color: channel.color, fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em",
        }}>
          <span style={{ fontSize: 9 }}>🔊</span> AUDIO
        </div>
      )}

      {status === "loading" && (
        <div style={overlayStyle}>
          <div style={{ color: "#555", fontFamily: "monospace", fontSize: 12 }}>connecting…</div>
        </div>
      )}
      {status === "idle" && (
        <div style={overlayStyle}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: channel.color, fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
              {channel.logo}
            </div>
            <div style={{ color: "#444", fontSize: 11, fontFamily: "monospace" }}>stream url not configured</div>
          </div>
        </div>
      )}
      {status === "error" && (
        <div style={overlayStyle}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#ef5350", fontFamily: "monospace", fontSize: 11, marginBottom: 4 }}>stream error</div>
            <div style={{ color: "#555", fontSize: 10, fontFamily: "monospace" }}>{channel.stream?.slice(0, 40)}…</div>
          </div>
        </div>
      )}

      {status === "playing" && (
        <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          style={{
            position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.5)",
            border: "none", color: "#aaa", cursor: "pointer",
            padding: "3px 6px", borderRadius: 3, fontSize: 12, lineHeight: 1,
          }} title="Fullscreen">⛶</button>
      )}
    </div>
  );
}

const overlayStyle = {
  position: "absolute", inset: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "#0a0a0a",
};
