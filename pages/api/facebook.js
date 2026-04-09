// api/facebook.js
// Fetches "Facebook posts" via RSS feeds (rss.app) — no API key required.
// Usage: GET /api/facebook?id=tisza

import Parser from "rss-parser";
import { FACEBOOK_PAGES } from "../../lib/config";

const parser = new Parser({
  customFields: {
    item: [["media:content", "mediaContent"]],
  },
});

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const page = FACEBOOK_PAGES.find((p) => p.id === id);
  if (!page) return res.status(404).json({ error: `Page "${id}" not found` });

  try {
    const feed = await parser.parseURL(page.rssUrl);

    const posts = (feed.items || [])
      .slice(0, 20)
      .map((item) => {
        const image =
          item.mediaContent?.["$"]?.url ||
          item.mediaContent?.url ||
          null;

        const text = item.title ? stripHtml(item.title) : null;

        return {
          id: item.guid || item.link,
          text,
          createdAt: item.isoDate || item.pubDate || new Date().toISOString(),
          image,
          url: item.link,
        };
      })
      .filter((p) => p.text || p.image);

    return res.json({
      id: page.id,
      label: page.label,
      color: page.color,
      profileImage: feed.image?.url || null,
      posts, // same shape as tweets (basically)
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`facebook RSS fetch failed for ${id}:`, e.message);
    return res.status(500).json({ error: e.message, posts: [] });
  }
}