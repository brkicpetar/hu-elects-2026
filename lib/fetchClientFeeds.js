// lib/fetchClientFeeds.js
// Runs in the browser. Fetches Cloudflare-protected RSS feeds directly
// (the browser already has CF cookies), parses them via /api/rss-proxy,
// and returns structured article arrays.

export async function fetchClientFeeds(clientFeeds) {
  if (!clientFeeds?.length) return [];

  const results = await Promise.allSettled(
    clientFeeds.map(async (feed) => {
      try {
        // Step 1: fetch XML directly from browser (CF cookie present)
        const xmlRes = await fetch(feed.url, {
          headers: {
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!xmlRes.ok) throw new Error(`HTTP ${xmlRes.status}`);
        const xml = await xmlRes.text();

        // Step 2: POST raw XML to our server-side parser
        const parseRes = await fetch("/api/rss-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            xml,
            source: feed.source,
            lang: feed.lang,
            category: feed.category,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!parseRes.ok) throw new Error(`Parse failed: ${parseRes.status}`);
        const data = await parseRes.json();
        return data.articles || [];
      } catch (e) {
        console.warn(`Client feed ${feed.source} failed:`, e.message);
        return [];
      }
    })
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
