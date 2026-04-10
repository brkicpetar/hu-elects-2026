import { useState, useEffect } from "react";
import { formatInTimeZone } from "date-fns-tz";

export default function TopBar({ keywords, setKeywords, displayLang, setDisplayLang, lastFetch, alertCount }) {
  const [time, setTime] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [showKeywords, setShowKeywords] = useState(false);

  useEffect(() => {
    const tick = () => {
      setTime(formatInTimeZone(new Date(), "Europe/Belgrade", "HH:mm:ss 'CET'  dd.MM.yyyy"));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const addKeyword = (e) => {
    e.preventDefault();
    const kw = keyInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
    }
    setKeyInput("");
  };

  const removeKeyword = (kw) => setKeywords(keywords.filter((k) => k !== kw));

  return (
    <header
      style={{
        background: "#080808",
        borderBottom: "1px solid #1e1e1e",
        padding: "0 20px",
        height: 48,
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexShrink: 0,
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#e53935",
            animation: "blink 2s ease-in-out infinite",
          }}
        />
        <span
          style={{
            color: "#e0e0e0",
            fontFamily: "'DM Mono', monospace",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          HU/ELECTS 2026
        </span>
        <span
          style={{
            color: "#e53935",
            fontFamily: "'DM Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            border: "1px solid #222",
            padding: "1px 5px",
            borderRadius: 2,
          }}
        >
          LIVE
        </span>
      </div>

      {/* Clock */}
      <div
        style={{
          color: "#4caf50",
          fontFamily: "'DM Mono', monospace",
          fontSize: 12,
          letterSpacing: "0.08em",
          flexShrink: 0,
        }}
      >
        {time}
      </div>

      {/* Alert count */}
      {alertCount > 0 && (
        <div
          style={{
            background: "#f57f1715",
            border: "1px solid #f57f1740",
            color: "#f9a825",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 3,
            letterSpacing: "0.06em",
            animation: "alertPulse 2s ease-in-out infinite",
            flexShrink: 0,
          }}
        >
          ● {alertCount} ALERT{alertCount !== 1 ? "S" : ""}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Last fetch indicator */}
      {lastFetch && (
        <div style={{ color: "#424242", fontFamily: "monospace", fontSize: 10, flexShrink: 0 }}>
          last sync {formatInTimeZone(new Date(lastFetch), "Europe/Belgrade", "HH:mm:ss")}
        </div>
      )}

      {/* Keywords toggle */}
      <button
        onClick={() => setShowKeywords(!showKeywords)}
        style={{
          background: showKeywords ? "#1a1a1a" : "transparent",
          border: "1px solid #222",
          color: "#888",
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          padding: "4px 10px",
          borderRadius: 3,
          cursor: "pointer",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        ⚡ Keywords {keywords.length > 0 && `(${keywords.length})`}
      </button>

      {/* Language switcher */}
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        {["hu", "en"].map((lang) => (
          <button
            key={lang}
            onClick={() => setDisplayLang(lang)}
            style={{
              background: displayLang === lang ? "#e53935" : "transparent",
              border: "1px solid " + (displayLang === lang ? "#e53935" : "#222"),
              color: displayLang === lang ? "#fff" : "#555",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 3,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              transition: "all 0.15s",
            }}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* Keywords dropdown */}
      {showKeywords && (
        <div
          style={{
            position: "absolute",
            top: 50,
            right: 140,
            background: "#0d0d0d",
            border: "1px solid #222",
            borderRadius: 6,
            padding: 16,
            minWidth: 320,
            zIndex: 200,
            boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          }}
        >
          <div style={{ color: "#555", fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>
            Keyword alerts — articles are highlighted when matched
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {keywords.map((kw) => (
              <span
                key={kw}
                onClick={() => removeKeyword(kw)}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #424242",
                  color: "#f9a825",
                  fontFamily: "monospace",
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 3,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                title="Click to remove"
              >
                {kw} <span style={{ color: "#555", fontSize: 9 }}>×</span>
              </span>
            ))}
          </div>
          <form onSubmit={addKeyword} style={{ display: "flex", gap: 6 }}>
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="add keyword…"
              style={{
                flex: 1,
                background: "#111",
                border: "1px solid #222",
                borderRadius: 4,
                color: "#e0e0e0",
                fontFamily: "monospace",
                fontSize: 11,
                padding: "5px 8px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                background: "#e53935",
                border: "none",
                color: "#fff",
                fontFamily: "monospace",
                fontSize: 11,
                padding: "5px 12px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              add
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
