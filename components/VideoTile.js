import { useEffect, useRef, useState } from "react";

const HLSType = ["m3u8", "/m1", "/novas", "/proxy"];

const isHLS = (url) => HLSType.some((k) => url?.includes(k));

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
  const [status, setStatus] = useState("idle");

  const destroyedRef = useRef(false);
  const retryRef = useRef(0);

  useEffect(() => {
    destroyedRef.current = false;
    const video = videoRef.current;
    const url = channel.stream;

    if (!video || !url) {
      setStatus("idle");
      return;
    }

    if (isEmbed(url)) {
      setStatus("playing");
      return;
    }

    setStatus("loading");

    const cleanup = () => {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {}
    };

    const load = () => {
      cleanup();
      if (destroyedRef.current) return;

      video.src = url;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true; // required for autoplay

      const onCanPlay = async () => {
        try {
          await video.play();
          video.muted = !isAudioActive;
          setStatus("playing");
          retryRef.current = 0;
        } catch {
          setStatus("error");
        }
      };

      const onError = () => {
        console.warn("Video error");

        // 🔥 smart retry instead of reload
        if (retryRef.current < 2) {
          retryRef.current++;
          setTimeout(load, 800);
        } else {
          setStatus("error");
        }
      };

      video.addEventListener("canplay", onCanPlay, { once: true });
      video.addEventListener("error", onError, { once: true });
    };

    load();

    return () => {
      destroyedRef.current = true;
      cleanup();
    };
  }, [channel.stream]);

  // audio sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isAudioActive;
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
      style={{
        position: "relative",
        background: "#0a0a0a",
        borderRadius: 6,
        overflow: "hidden",
        aspectRatio: "16/9",
        border: isAudioActive
          ? `2px solid ${channel.color}`
          : "2px solid #1a1a1a",
        cursor: "pointer",
      }}
    >
      {embedUrl ? (
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}

      {/* LABEL */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: channel.color,
          color: "#fff",
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 3,
          fontFamily: "monospace",
        }}
      >
        {channel.name}
      </div>

      {/* STATUS */}
      {status === "loading" && (
        <Overlay text="connecting…" />
      )}

      {status === "error" && (
        <Overlay text="stream error" />
      )}

      {/* FULLSCREEN */}
      {status === "playing" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            background: "rgba(0,0,0,0.5)",
            border: "none",
            color: "#aaa",
            padding: "3px 6px",
            borderRadius: 3,
          }}
        >
          ⛶
        </button>
      )}
    </div>
  );
}

const Overlay = ({ text }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0a0a",
      color: "#555",
      fontFamily: "monospace",
      fontSize: 12,
    }}
  >
    {text}
  </div>
);