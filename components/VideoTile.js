import { useEffect, useRef, useState } from "react";

const isEmbed = (url) =>
    url.startsWith("embed:") ||
    url.includes("player.php") ||
    url.includes("youtube.com") ||
    url.includes("youtu.be");

const getEmbedUrl = (url) => (url.startsWith("embed:") ? url.slice(6) : url);

// Detect stream type — checks explicit streamType first, then falls back to URL sniffing.
function getStreamType(channel) {
  if (!channel.stream) return "idle";
  if (channel.streamType) return channel.streamType;

  const url = channel.stream;
  if (isEmbed(url)) return "embed";
  if (
      url.includes(".m3u8") ||
      url.includes("m3u8") ||
      url.includes("/m1") ||
      url.includes("/proxy") ||
      url.includes("/novas") ||
      url.includes("/hirtv")
  ) {
    return "hls";
  }
  if (url.endsWith(".webm") || url.includes("/rtl")) return "webm";
  return "mpegts";
}

export default function VideoTile({ channel, isAudioActive, onActivateAudio }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const streamType = channel.stream ? getStreamType(channel) : "idle";

  // Keep fullscreen state in React so the tile and video can fit the screen without cropping.
  useEffect(() => {
    const handleFullscreenChange = () => {
      const tile = document.getElementById(`tile-${channel.id}`);
      setIsFullscreen(document.fullscreenElement === tile);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [channel.id]);

  // HLS + MPEG-TS loader
  useEffect(() => {
    if (!videoRef.current) return;
    if (streamType !== "hls" && streamType !== "mpegts") return;

    setStatus("loading");
    let destroyed = false;
    const video = videoRef.current;

    const loadStream = async () => {
      const url = channel.stream;

      if (streamType === "hls") {
        try {
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
              if (destroyed) return;
              setStatus("playing");
              video.muted = true;
              video.play().then(() => {
                video.muted = !isAudioActive;
              }).catch(() => {});
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal && !destroyed) setStatus("error");
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
            const onLoadedMetadata = () => {
              if (destroyed) return;
              setStatus("playing");
              video.muted = true;
              video.play().then(() => {
                video.muted = !isAudioActive;
              }).catch(() => {});
            };
            video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
          } else {
            setStatus("error");
          }
        } catch (error) {
          console.error("Failed to load HLS.js:", error);
          if (!destroyed) setStatus("error");
        }
      } else {
        // MPEG-TS
        try {
          const mpegts = (await import("mpegts.js")).default;
          if (destroyed) return;
          if (!mpegts.isSupported()) {
            setStatus("error");
            return;
          }

          const player = mpegts.createPlayer(
              { type: "mpegts", isLive: true, url, hasAudio: true, hasVideo: true },
              {
                enableWorker: true,
                enableStashBuffer: false,
                liveBufferLatencyChasing: true,
                liveBufferLatencyMaxLatency: 8,
                liveBufferLatencyMinRemain: 2,
              }
          );

          playerRef.current = player;
          player.attachMediaElement(video);
          player.load();

          const onCanPlay = () => {
            if (!destroyed) {
              setStatus("playing");
              video.play().catch(() => {});
            }
          };

          video.addEventListener("canplay", onCanPlay, { once: true });
          player.on(mpegts.Events.ERROR, () => {
            if (!destroyed) setStatus("error");
          });
          playerRef.current._onCanPlay = onCanPlay;
          playerRef.current._video = video;
        } catch (error) {
          console.error("Failed to load MPEG-TS player:", error);
          if (!destroyed) setStatus("error");
        }
      }
    };

    loadStream();

    return () => {
      destroyed = true;
      if (playerRef.current) {
        try {
          const player = playerRef.current;
          if (player._video && player._onCanPlay) {
            player._video.removeEventListener("canplay", player._onCanPlay);
          }
          if (typeof player.destroy === "function") {
            player.destroy();
          } else if (typeof player.stopLoad === "function") {
            player.stopLoad();
            player.detachMedia();
          }
        } catch (error) {
          console.warn("Error while cleaning up stream player:", error);
        }
        playerRef.current = null;
      }
    };
  }, [channel.stream, streamType]);

  // WebM loader
  useEffect(() => {
    if (!videoRef.current || streamType !== "webm") return;

    let destroyed = false;
    const video = videoRef.current;

    video.muted = true;
    video.src = channel.stream;
    video.load();

    video.play()
        .then(() => {
          if (destroyed) return;
          video.muted = !isAudioActive;
          setStatus("playing");
        })
        .catch(() => {
          if (!destroyed) setStatus("playing");
        });

    return () => {
      destroyed = true;
      video.pause();
      video.src = "";
      video.load();
    };
  }, [channel.stream, streamType]);

  // Mute/unmute on active tile switch — all native video stream types.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isAudioActive;
  }, [isAudioActive]);

  const toggleFullscreen = async () => {
    const tile = document.getElementById(`tile-${channel.id}`);
    if (!tile) return;

    try {
      if (!document.fullscreenElement) {
        await tile.requestFullscreen();
      } else if (document.fullscreenElement === tile) {
        await document.exitFullscreen();
      } else {
        await document.exitFullscreen();
        await tile.requestFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  };

  const embedUrl = streamType === "embed" ? getEmbedUrl(channel.stream) : null;

  const tileStyle = {
    position: isFullscreen ? "relative" : "relative",
    width: isFullscreen ? "100vw" : "100%",
    height: isFullscreen ? "100dvh" : "auto",
    maxWidth: isFullscreen ? "none" : undefined,
    maxHeight: isFullscreen ? "none" : undefined,
    boxSizing: "border-box",
    aspectRatio: isFullscreen ? "auto" : "16 / 9",
    background: "#000",
    borderRadius: isFullscreen ? "0" : "6px",
    overflow: "hidden",
    border: isFullscreen
        ? "none"
        : isAudioActive
            ? `2px solid ${channel.color}`
            : "2px solid #1a1a1a",
    transition: isFullscreen ? "none" : "border-color 0.2s",
    cursor: "pointer",
  };

  return (
      <div
          id={`tile-${channel.id}`}
          style={tileStyle}
          onClick={() => onActivateAudio(channel.id)}
      >
        {embedUrl ? (
            <iframe
                src={embedUrl}
                title={`${channel.name} player`}
                style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                allowFullScreen
                allow="autoplay; fullscreen"
                scrolling="no"
            />
        ) : (
            <video
                ref={videoRef}
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: isFullscreen ? "contain" : "cover",
                  display: "block",
                  background: "#000",
                }}
            />
        )}

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
              pointerEvents: "none",
              zIndex: 2,
            }}
        >
          {channel.name}
        </div>

        {/* Audio indicator */}
        {isAudioActive && !embedUrl && (
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
                  pointerEvents: "none",
                  zIndex: 2,
                }}
            >
              <span style={{ fontSize: 9 }}>🔊</span> AUDIO
            </div>
        )}

        {status === "loading" && (
            <div style={overlayStyle}>
              <div style={{ color: "#555", fontFamily: "monospace", fontSize: 12 }}>
                connecting…
              </div>
            </div>
        )}

        {status === "idle" && (
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
                <div style={{ color: "#444", fontSize: 11, fontFamily: "monospace" }}>
                  stream url not configured
                </div>
              </div>
            </div>
        )}

        {status === "error" && (
            <div style={overlayStyle}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#ef5350", fontFamily: "monospace", fontSize: 11, marginBottom: 4 }}>
                  stream error
                </div>
                <div style={{ color: "#555", fontSize: 10, fontFamily: "monospace" }}>
                  {channel.stream?.slice(0, 40)}…
                </div>
              </div>
            </div>
        )}

        {status === "playing" && (
            <button
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFullscreen();
                }}
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  background: "rgba(0,0,0,0.65)",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  padding: "5px 8px",
                  borderRadius: 3,
                  fontSize: 18,
                  lineHeight: 1,
                  zIndex: 10,
                }}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? "⤢" : "⛶"}
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
