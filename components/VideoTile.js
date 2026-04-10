import { useEffect, useRef, useState } from "react";

const isHLS = (url) =>
  ["m3u8", "/m1", "/novas", "/proxy"].some((k) => url.includes(k));

const isEmbed = (url) =>
  url?.startsWith("embed:") ||
  url?.includes("player.php") ||
  url?.includes("youtube.com") ||
  url?.includes("youtu.be");

const getEmbedUrl = (url) =>
  url?.startsWith("embed:") ? url.slice(6) : url;

export default function VideoTile({
  channel,
  isAudioActive,
  onActivateAudio,
}) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const modeRef = useRef(null); // "hls" | "mpegts"
  const destroyedRef = useRef(false);

  const [status, setStatus] = useState("idle");

  useEffect(() => {
    destroyedRef.current = false;

    const video = videoRef.current;
    const url = channel.stream;

    if (!url || !video) {
      setStatus("idle");
      return;
    }

    if (isEmbed(url)) {
      setStatus("playing");
      return;
    }

    setStatus("loading");

    const cleanup = async () => {
      const p = playerRef.current;
      if (!p) return;

      try {
        if (modeRef.current === "hls") {
          p.destroy();
        } else if (modeRef.current === "mpegts") {
          p.destroy?.();
          p.stopLoad?.();
          p.detachMedia?.();
        }
      } catch {}

      playerRef.current = null;
      modeRef.current = null;
    };

    const load = async () => {
      await cleanup();
      if (destroyedRef.current) return;

      // =========================
      // HLS
      // =========================
      if (isHLS(url)) {
        const Hls = (await import("hls.js")).default;
        if (destroyedRef.current) return;

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 30,
          });

          modeRef.current = "hls";
          playerRef.current = hls;

          hls.loadSource(url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, async () => {
            if (destroyedRef.current) return;

            try {
              video.muted = true;
              await video.play();
              video.muted = !isAudioActive;
              setStatus("playing");
            } catch {
              setStatus("error");
            }
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              console.warn("HLS fatal error", data);
              setStatus("error");
            }
          });
        } else {
          video.src = url;
          setStatus("playing");
        }

        return;
      }

      // =========================
      // MPEGTS
      // =========================
      const mpegts = (await import("mpegts.js")).default;
      if (destroyedRef.current) return;

      if (!mpegts.isSupported()) {
        setStatus("error");
        return;
      }

      const player = mpegts.createPlayer(
        {
          type: "mpegts",
          isLive: true,
          url,
          hasAudio: true,
          hasVideo: true,
        },
        {
          enableWorker: true,

          // IMPORTANT: stability > latency for TVHeadend
          enableStashBuffer: true,
          stashInitialSize: 512,

          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 8,
          liveBufferLatencyMinRemain: 2,
        }
      );

      modeRef.current = "mpegts";
      playerRef.current = player;

      player.attachMediaElement(video);
      player.load();

      player.on(mpegts.Events.ERROR, (_, detail) => {
        console.warn("MPEGTS error:", detail);

        // HARD RESET (MSE cannot recover)
        setStatus("error");

        try {
          player.destroy();
        } catch {}

        playerRef.current = null;
      });

      player.on(mpegts.Events.STREAM_LOADED, async () => {
        if (destroyedRef.current) return;

        try {
          await video.play();
          setStatus("playing");
        } catch {
          setStatus("error");
        }
      });
    };

    load();

    return () => {
      destroyedRef.current = true;
      cleanup();
    };
  }, [channel.stream]);

  // mute sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isAudioActive;
    }
  }, [isAudioActive]);

  const toggleFullscreen = () => {
    const el = document.getElementById(`tile-${channel.id}`);
    if (!document.fullscreenElement) el?.requestFullscreen();
    else document.exitFullscreen();
  };

  const embedUrl =
    channel.stream && isEmbed(channel.stream)
      ? getEmbedUrl(channel.stream)
      : null;

  return (
    <div
      id={`tile-${channel.id}`}
      onClick={() => onActivateAudio(channel.id)}
      style={wrapperStyle(channel, isAudioActive)}
    >
      {embedUrl ? (
        <iframe
          src={embedUrl}
          style={iframeStyle}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          style={videoStyle}
        />
      )}

      {/* UI overlays */}
      <div style={labelStyle(channel)}>{channel.name}</div>

      {status === "loading" && (
        <Overlay text="connecting…" />
      )}

      {status === "error" && (
        <Overlay
          text="stream error"
          sub={channel.stream?.slice(0, 40)}
          color="#ef5350"
        />
      )}

      {status === "playing" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          style={fsButton}
        >
          ⛶
        </button>
      )}
    </div>
  );
}

/* ================= UI helpers ================= */

const Overlay = ({ text, sub, color = "#555" }) => (
  <div style={overlayStyle}>
    <div style={{ textAlign: "center" }}>
      <div style={{ color, fontFamily: "monospace", fontSize: 12 }}>
        {text}
      </div>
      {sub && (
        <div style={{ color: "#444", fontSize: 10 }}>{sub}</div>
      )}
    </div>
  </div>
);

const wrapperStyle = (channel, active) => ({
  position: "relative",
  background: "#0a0a0a",
  borderRadius: 6,
  overflow: "hidden",
  border: active
    ? `2px solid ${channel.color}`
    : "2px solid #1a1a1a",
  aspectRatio: "16/9",
  cursor: "pointer",
});

const videoStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const iframeStyle = videoStyle;

const overlayStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0a0a0a",
};

const labelStyle = (channel) => ({
  position: "absolute",
  top: 8,
  left: 8,
  background: channel.color,
  color: "#fff",
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 3,
  fontFamily: "monospace",
});

const fsButton = {
  position: "absolute",
  bottom: 8,
  right: 8,
  background: "rgba(0,0,0,0.5)",
  border: "none",
  color: "#aaa",
  padding: "3px 6px",
  cursor: "pointer",
};