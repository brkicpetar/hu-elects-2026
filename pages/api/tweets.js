// api/tweets.js
// Fetches tweets via rss.app RSS feed — no API key required.
// Usage: GET /api/tweets?id=magyar  (id must match TWITTER_ACCOUNTS in config)

import Parser from "rss-parser";
import { TWITTER_ACCOUNTS } from "../../lib/config";

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

  const account = TWITTER_ACCOUNTS.find((a) => a.id === id);
  if (!account) return res.status(404).json({ error: `Account "${id}" not found` });

  try {
    const feed = await parser.parseURL(account.rssUrl);

    // rss.app puts the tweet text in item.title, image in media:content
    const tweets = (feed.items || []).slice(0, 20).map((item) => {
      const image =
        item.mediaContent?.["$"]?.url ||
        item.mediaContent?.url ||
        null;

      // title is the raw tweet text; skip items that are just "Image" with no text
      const text = item.title && item.title !== "Image" ? item.title : null;

      return {
        id: item.guid || item.link,
        text,
        createdAt: item.isoDate || item.pubDate || new Date().toISOString(),
        image,
        url: item.link || `https://x.com/${account.handle}`,
      };
    }).filter((t) => t.text || t.image); // skip completely empty items

    // Pull profile image from feed channel if not hardcoded
    const profileImage = account.profileImage || feed.image?.url || null;

    return res.json({
      id: account.id,
      handle: account.handle,
      label: account.label,
      color: account.color,
      profileImage,
      tweets,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`tweets RSS fetch failed for ${id}:`, e.message);
    return res.status(500).json({ error: e.message, tweets: [] });
  }
}
