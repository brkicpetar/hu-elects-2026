// /api/stream-token.js
// Called by the browser to get a fresh .m3u8 URL for a given channel.
// For M1 (and other mediaklikk channels) this hits the mediaklikk player API
// which returns a JWPlayer config containing a fresh tokenized .m3u8 URL.

const MEDIAKLIKK_CHANNELS = {
  m1: "mtv1live",
  m2: "mtv2live",
  m4: "m4sportlive",
  duna: "dunatvlive",
};

export default async function handler(req, res) {
  const { channel } = req.query;

  // Only handle mediaklikk channels via this route
  if (!MEDIAKLIKK_CHANNELS[channel]) {
    return res.status(400).json({ error: "Unknown channel" });
  }

  const streamId = MEDIAKLIKK_CHANNELS[channel];

  try {
    // Fetch the player page which contains the JWPlayer config with fresh token
    const playerRes = await fetch(
      `https://player.mediaklikk.hu/playernew/player.php?video=${streamId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://mediaklikk.hu/",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!playerRes.ok) {
      throw new Error(`Player page returned ${playerRes.status}`);
    }

    const html = await playerRes.text();

    // Extract the m3u8 URL from the JWPlayer setup config
    // The player page contains something like: file: "https://...token.../index.m3u8"
    const m3u8Match =
      html.match(/["']file["']\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i) ||
      html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);

    if (!m3u8Match) {
      // Try extracting from JSON-like structure
      const jsonMatch = html.match(/sources\s*:\s*\[(.*?)\]/s);
      if (jsonMatch) {
        const urlMatch = jsonMatch[1].match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
        if (urlMatch) {
          return res.setHeader("Cache-Control", "no-store").json({ url: urlMatch[1] });
        }
      }
      throw new Error("Could not extract m3u8 URL from player page");
    }

    const m3u8Url = m3u8Match[1];

    // No caching — token expires, always fetch fresh
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({ url: m3u8Url });
  } catch (err) {
    console.error("stream-token error:", err.message);
    res.status(502).json({ error: err.message });
  }
}
