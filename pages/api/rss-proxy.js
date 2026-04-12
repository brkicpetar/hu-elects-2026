// api/rss-proxy.js
// Fetches an RSS feed URL server-side and returns raw XML.
// Called from the browser (which already has a valid Cloudflare cookie)
// via a relative fetch — so the request goes browser → Vercel → target site.
//
// Wait — this won't help because Vercel's IP still hits Cloudflare.
// Instead this acts as the XML parser endpoint:
// The BROWSER fetches the RSS URL directly (it has the CF cookie),
// then POSTs the raw XML here to be parsed into structured JSON.
//
// Usage: POST /api/rss-proxy
// Body: { xml: "<rss>...</rss>", source, lang, category }
// Returns: { articles: [...] }

import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["enclosure", "enclosure"],
    ],
  },
});

function extractThumbnail(item) {
  if (item.mediaContent?.["$"]?.url) return item.mediaContent["$"].url;
  if (item.mediaThumbnail?.["$"]?.url) return item.mediaThumbnail["$"].url;
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image"))
    return item.enclosure.url;
  const match = (item["content:encoded"] || item.content || "").match(
    /<img[^>]+src=["']([^"']+)["']/i
  );
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { xml, source, lang, category } = req.body;
  if (!xml) return res.status(400).json({ error: "Missing xml" });

  try {
    const parsed = await parser.parseString(xml);
    const articles = parsed.items.slice(0, 15).map((item) => ({
      id: item.guid || item.link || item.title,
      title: item.title || "",
      summary: item.contentSnippet || item.summary || "",
      link: item.link || "",
      pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
      thumbnail: extractThumbnail(item),
      source,
      lang,
      category,
      titleEn: null,
      summaryEn: null,
      cluster: null,
    }));
    res.json({ articles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
