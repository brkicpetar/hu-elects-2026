import Parser from "rss-parser";
import { TWITTER_ACCOUNTS } from "../../lib/config";

const parser = new Parser({
  customFields: { item: [["media:content", "mediaContent"]] },
});

async function translateTexts(texts) {
  if (!texts.length) return texts;
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) return texts;
    const data = await res.json();
    return data.translated || texts;
  } catch (e) {
    console.error("translateTexts failed:", e.message);
    return texts;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const account = TWITTER_ACCOUNTS.find((a) => a.id === id);
  if (!account) return res.status(404).json({ error: `Account "${id}" not found` });

  try {
    const feed = await parser.parseURL(account.rssUrl);

    const raw = (feed.items || []).slice(0, 20).map((item) => {
      const image = item.mediaContent?.["$"]?.url || item.mediaContent?.url || null;
      const text = item.title && item.title !== "Image" ? item.title : null;
      return {
        id: item.guid || item.link,
        text,
        createdAt: item.isoDate || item.pubDate || new Date().toISOString(),
        image,
        url: item.link || `https://x.com/${account.handle}`,
      };
    }).filter((t) => t.text || t.image);

    // Translate non-empty texts
    const textsToTranslate = raw.map((t) => t.text || "");
    const translated = await translateTexts(textsToTranslate);

    const tweets = raw.map((t, i) => ({
      ...t,
      textEn: translated[i] && translated[i] !== t.text ? translated[i] : null,
    }));

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
