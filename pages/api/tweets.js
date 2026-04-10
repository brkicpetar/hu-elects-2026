import Parser from "rss-parser";
import crypto from "crypto";
import { TWITTER_ACCOUNTS } from "../../lib/config";

const parser = new Parser({
  customFields: { item: [["media:content", "mediaContent"]] },
});

const translationCache = new Map();

function getCacheKey(text) {
  return crypto.createHash("md5").update(text || "").digest("hex");
}

async function translateOne(text) {
  if (!text || !text.trim()) return text;
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return text;
    const data = await res.json();
    return data[0]?.map((chunk) => chunk[0]).join("") || text;
  } catch {
    return text;
  }
}

async function translateAll(texts, concurrency = 4) {
  const results = new Array(texts.length).fill(null);
  for (let i = 0; i < texts.length; i += concurrency) {
    const slice = texts.slice(i, i + concurrency);
    const done = await Promise.all(slice.map((t) => translateOne(t)));
    done.forEach((val, j) => { results[i + j] = val; });
  }
  return results;
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

    // Translate only uncached texts
    const withText = raw.filter((t) => t.text);
    const toTranslate = withText.filter((t) => !translationCache.has(getCacheKey(t.text)));

    if (toTranslate.length > 0) {
      const translated = await translateAll(toTranslate.map((t) => t.text), 4);
      toTranslate.forEach((tweet, i) => {
        translationCache.set(
          getCacheKey(tweet.text),
          translated[i] !== tweet.text ? translated[i] : null
        );
      });
    }

    const tweets = raw.map((t) => ({
      ...t,
      textEn: t.text ? (translationCache.get(getCacheKey(t.text)) ?? null) : null,
    }));

    return res.json({
      id: account.id,
      handle: account.handle,
      label: account.label,
      color: account.color,
      profileImage: account.profileImage || feed.image?.url || null,
      tweets,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`tweets RSS fetch failed for ${id}:`, e.message);
    return res.status(500).json({ error: e.message, tweets: [] });
  }
}
