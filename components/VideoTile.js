import { useEffect, useRef, useState } from "react";

export default function VideoTile({ channel, isActive, isAudioActive, onActivateAudio, index }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | loading | playing | error
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const isConfigured = channel.stream || channel.tokenChannel || channel.useAtvProxy;
    if (!isConfigured || !videoRef.current) {
      setStatus("idle");
      return;
    }

    setStatus("loading");

    let hls;
    let destroyed = false;
    const video = videoRef.current;

    const loadStream = async () => {
      const Hls = (await import("hls.js")).default;

      // Resolve stream URL — fetch fresh token if needed
      let streamUrl = channel.stream;

      if (channel.tokenChannel) {
        // Mediaklikk channel — fetch fresh tokenized URL from our API
        try {
          const res = await fetch(`/api/stream-token?channel=${channel.tokenChannel}`);
          const data = await res.json();
          if (data.url) {
            streamUrl = data.url;
          } else {
            throw new Error(data.error || "No URL returned");
          }
        } catch (err) {
          console.error("Token fetch failed:", err);
          if (!destroyed) setStatus("error");
          return;
        }
      } else if (channel.useAtvProxy) {
        // ATV — route through our HTTPS proxy
        streamUrl = "/api/atv-proxy";
      }

      if (destroyed) return;

      if (Hls.isSupported() && (channel.stream.includes(".m3u8") || channel.stream.includes("m3u8"))) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!destroyed) {
            setStatus("playing");
            video.play().catch(() => {});
          }
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal && !destroyed) setStatus("error");
        });
      } else if (video.canPlayType("video/mp2t") || video.canPlayType("video/mpeg")) {
        // Direct MPEG-TS stream (transcoded)
        video.src = channel.stream;
        video.addEventListener("canplay", () => {
          setStatus("playing");
          video.play().catch(() => {});
        });
        video.addEventListener("error", () => setStatus("error"));
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", () => {
          if (!destroyed) {
            setStatus("playing");
            video.play().catch(() => {});
          }
        });
      } else {
        setStatus("error");
      }
    };

    loadStream();

    return () => {
      destroyed = true;
      if (hls) hls.destroy();
    };
  }, [channel.stream, channel.tokenChannel, channel.useAtvProxy]);

  // Mute/unmute based on audio selection
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isAudioActive;
    }
  }, [isAudioActive]);

  const toggleFullscreen = () => {
    const tile = videoRef.current?.closest(".video-tile");
    if (!document.fullscreenElement) {
      tile?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      className="video-tile"
      style={{
        position: "relative",
        background: "#0a0a0a",
        borderRadius: "6px",
        overflow: "hidden",
        border: isAudioActive
          ? `2px solid ${channel.color}`
          : "2px solid #1a1a1a",
        transition: "border-color 0.2s",
        cursor: "pointer",
        aspectRatio: "16/9",
      }}
      onClick={() => onActivateAudio(channel.id)}
    >
      <video
        ref={videoRef}
        muted={!isAudioActive}
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {/* Channel label */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: channel.color,
          color: "#fff",
          fontFamily: "'DM Mono', monospace",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.08em",
          padding: "2px 8px",
          borderRadius: 3,
          textTransform: "uppercase",
        }}
      >
        {channel.name}
      </div>

      {/* Audio indicator */}
      {isAudioActive && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(0,0,0,0.7)",
            padding: "3px 7px",
            borderRadius: 3,
            color: channel.color,
            fontSize: 10,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.05em",
          }}
        >
          <span style={{ fontSize: 9 }}>🔊</span> AUDIO
        </div>
      )}

      {/* Status overlays */}
      {status === "loading" && (
        <div style={overlayStyle}>
          <div style={{ color: "#555", fontFamily: "monospace", fontSize: 12 }}>connecting…</div>
        </div>
      )}
      {status === "idle" && !channel.stream && (
        <div style={overlayStyle}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                color: channel.color,
                fontFamily: "'DM Mono', monospace",
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {channel.logo}
            </div>
            <div style={{ color: "#444", fontSize: 11, fontFamily: "monospace" }}>stream url not configured</div>
          </div>
        </div>
      )}
      {status === "error" && (
        <div style={overlayStyle}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#ef5350", fontFamily: "monospace", fontSize: 11, marginBottom: 4 }}>
              stream error
            </div>
            <div style={{ color: "#555", fontSize: 10, fontFamily: "monospace" }}>{channel.stream?.slice(0, 40)}…</div>
          </div>
        </div>
      )}

      {/* Fullscreen button */}
      {status === "playing" && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            background: "rgba(0,0,0,0.5)",
            border: "none",
            color: "#aaa",
            cursor: "pointer",
            padding: "3px 6px",
            borderRadius: 3,
            fontSize: 12,
            lineHeight: 1,
          }}
          title="Fullscreen"
        >
          ⛶
        </button>
      )}
    </div>
  );
}

const overlayStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0a0a0a",
};
