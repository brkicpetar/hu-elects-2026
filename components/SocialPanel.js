import { useEffect, useRef } from "react";
import { SOCIAL_ACCOUNTS } from "../lib/config";

export default function SocialPanel({ visible }) {
  const twitterLoaded = useRef(false);
  const fbLoaded = useRef(false);

  useEffect(() => {
    if (!visible) return;

    // Load Twitter widget script
    if (!twitterLoaded.current) {
      if (window.twttr?.widgets) {
        window.twttr.widgets.load();
      } else {
        const script = document.createElement("script");
        script.src = "https://platform.twitter.com/widgets.js";
        script.async = true;
        script.charset = "utf-8";
        script.onload = () => window.twttr?.widgets?.load();
        document.head.appendChild(script);
      }
      twitterLoaded.current = true;
    } else {
      window.twttr?.widgets?.load();
    }

    // Load Facebook SDK
    if (!fbLoaded.current) {
      window.fbAsyncInit = function () {
        window.FB.init({ xfbml: true, version: "v19.0" });
      };
      if (!document.getElementById("fb-sdk")) {
        const fbScript = document.createElement("script");
        fbScript.id = "fb-sdk";
        fbScript.src = "https://connect.facebook.net/en_US/sdk.js";
        fbScript.async = true;
        fbScript.defer = true;
        fbScript.crossOrigin = "anonymous";
        document.head.appendChild(fbScript);
      }
      fbLoaded.current = true;
    } else {
      window.FB?.XFBML?.parse();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "12px 10px 20px" }}>
      <div style={{
        color: "#555", fontSize: 9, fontFamily: "'DM Mono', monospace",
        letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12,
      }}>
        Social feeds
      </div>

      {/* Twitter/X timelines */}
      {SOCIAL_ACCOUNTS.twitter.map((acc) => (
        <div key={acc.handle} style={{ marginBottom: 16 }}>
          <div style={{
            color: "#555", fontSize: 9, fontFamily: "monospace", marginBottom: 6,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              background: "#000", color: "#fff", fontSize: 9,
              fontWeight: 700, padding: "1px 5px", borderRadius: 2,
              fontFamily: "'DM Mono', monospace",
            }}>𝕏</span>
            <span style={{ color: acc.color }}>@{acc.handle}</span>
            <span style={{ color: "#444" }}>— {acc.label}</span>
          </div>
          <a
            className="twitter-timeline"
            data-theme="dark"
            data-height="300"
            data-chrome="noheader nofooter noborders transparent"
            data-tweet-limit="4"
            href={`https://twitter.com/${acc.handle}`}
            style={{ display: "block" }}
          >
            Loading @{acc.handle}…
          </a>
        </div>
      ))}

      {/* Facebook pages */}
      <div id="fb-root" />
      {SOCIAL_ACCOUNTS.facebook.map((page) => (
        <div key={page.pageUrl} style={{ marginBottom: 16 }}>
          <div style={{ color: "#444", fontSize: 9, fontFamily: "monospace", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#1877f2", fontWeight: 700, fontSize: 11 }}>f</span>
            <span>{page.label}</span>
          </div>
          <div
            className="fb-page"
            data-href={page.pageUrl}
            data-tabs="timeline"
            data-width="290"
            data-height="250"
            data-small-header="true"
            data-adapt-container-width="true"
            data-hide-cover="true"
            data-show-facepile="false"
            style={{ width: "100%" }}
          />
        </div>
      ))}
    </div>
  );
}
