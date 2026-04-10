import { useEffect, useRef, useState } from "react";

const isHLS = (url) => url.includes(".m3u8") || url.includes("m3u8") || url.includes("/m1") || url.includes("/proxy");
const isEmbed = (url) => url.startsWith("embed:") || url.includes("player.php") || url.includes("youtube.com") || url.includes("youtu.be");
const getEmbedUrl = (url) => url.startsWith("embed:") ? url.slice(6) : url;

export default function VideoTile({ channel, isAudioActive, onActivateAudio, globalVolume, globalMuted }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!channel.stream || !videoRef.current) {
      setStatus("idle");
      return;
    }
    if (isEmbed(channel.stream)) {
      setStatus("playing");
      return;
    }

    setStatus("loading");
    let destroyed = false;
    const video = videoRef.current;

    const loadStream = async () => {
      const url = channel.stream;

      if (isHLS(url)) {
        const Hls = (await import("hls.js")).default;
        if (destroyed) return;
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 30,
            manifestLoadingTimeOut: 20000,
            manifestLoadingMaxRetry: 3,
            levelLoadingTimeOut: 20000,
            fragLoadingTimeOut: 30000,
          });
          playerRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!destroyed) {
              setStatus("playing");
              video.muted = true; // must start muted for autoplay
              video.play().then(() => {
                if (!isAudioActive || globalMuted) {
                  video.muted = true;
                } else {
                  video.muted = false;
                  video.volume = globalVolume ?? 0.8;
                }
              }).catch(() => {});
            }
          });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal && !destroyed) setStatus("error");
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.addEventListener("loadedmetadata", () => {
            if (!destroyed) {
              setStatus("playing");
              video.muted = true;
              video.play().then(() => {
                if (!isAudioActive || globalMuted) {
                  video.muted = true;
                } else {
                  video.muted = false;
                  video.volume = globalVolume ?? 0.8;
                }
              }).catch(() => {});
            }
          });
        } else {
          setStatus("error");
        }
      } else {
        const mpegts = (await import("mpegts.js")).default;
        if (destroyed) return;
        if (!mpegts.isSupported()) { setStatus("error"); return; }

        const player = mpegts.createPlayer(
          { type: "mpegts", isLive: true, url, hasAudio: true, hasVideo: true },
          { enableWorker: true, enableStashBuffer: false, liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 8, liveBufferLatencyMinRemain: 2 }
        );
        playerRef.current = player;
        player.attachMediaElement(video);
        player.load();

        const onCanPlay = () => {
          if (!destroyed) { setStatus("playing"); video.play().catch(() => {}); }
        };
        video.addEventListener("canplay", onCanPlay, { once: true });
        player.on(mpegts.Events.ERROR, () => { if (!destroyed) setStatus("error"); });
        playerRef.current._onCanPlay = onCanPlay;
        playerRef.current._video = video;
      }
    };

    loadStream();

    return () => {
      destroyed = true;
      if (playerRef.current) {
        try {
          const p = playerRef.current;
          if (p._video && p._onCanPlay) p._video.removeEventListener("canplay", p._onCanPlay);
          if (typeof p.destroy === "function") p.destroy();
          else if (typeof p.stopLoad === "function") { p.stopLoad(); p.detachMedia(); }
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [channel.stream]);

  // React to audio active tile switching + global mute/volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!isAudioActive || globalMuted) {
      video.muted = true;
    } else {
      video.muted = false;
      video.volume = globalVolume ?? 0.8;
    }
  }, [isAudioActive, globalMuted, globalVolume]);

  const toggleFullscreen = () => {
    const tile = document.getElementById(`tile-${channel.id}`);
    if (!document.fullscreenElement) tile?.requestFullscreen();
    else document.exitFullscreen();
  };

  const embedUrl = channel.stream && isEmbed(channel.stream) ? getEmbedUrl(channel.stream) : null;

  return (
    <div
      id={`tile-${channel.id}`}
      className="video-tile"
      style={{
        position: "relative", background: "#0a0a0a", borderRadius: "6px",
        overflow: "hidden",
        border: isAudioActive ? `2px solid ${channel.color}` : "2px solid #1a1a1a",
        transition: "border-color 0.2s", cursor: "pointer", aspectRatio: "16/9",
      }}
      onClick={() => onActivateAudio(channel.id)}
    >
      {embedUrl ? (
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allowFullScreen
          allow="autoplay; fullscreen"
          scrolling="no"
        />
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}

      {/* Channel label */}
      <div style={{
        position: "absolute", top: 8, left: 8, background: channel.color, color: "#fff",
        fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 11,
        letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 3, textTransform: "uppercase",
        pointerEvents: "none",
      }}>
        {channel.name}
      </div>

      {/* Audio indicator */}
      {isAudioActive && !embedUrl && (
        <div style={{
          position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 4,
          background: "rgba(0,0,0,0.7)", padding: "3px 7px", borderRadius: 3,
          color: channel.color, fontSize: 10, fontFamily: "'DM Mono', monospace",
          letterSpacing: "0.05em", pointerEvents: "none",
        }}>
          <span style={{ fontSize: 9 }}>{globalMuted ? "🔇" : "🔊"}</span>
          {globalMuted ? "MUTED" : "AUDIO"}
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
            padding: "3px 6px", borderRadius: 3, fontSize: 12, lineHeight: 1, zIndex: 10,
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
