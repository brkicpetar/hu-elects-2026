import Parser from "rss-parser";
import crypto from "crypto";
import { TWITTER_ACCOUNTS } from "../../lib/config";

const parser = new Parser({
  customFields: { item: [["media:content", "mediaContent"]] },
});

// In-memory cache
// key: hash(text)
// value: translated text
const translationCache = new Map();

function getCacheKey(text) {
  return crypto
    .createHash("md5")
    .update(text || "")
    .digest("hex");
}

// ✅ SAME TRANSLATION FUNCTION (Google endpoint)
async function translateTexts(texts) {
  if (!texts.length) return texts;

  try {
    const query = encodeURIComponent(texts.join("\n"));

    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${query}`
    );

    if (!res.ok) return texts;

    const data = await res.json();

    // Extract translated strings
    return data[0].map((item) => item[0]);
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
  if (!account)
    return res.status(404).json({ error: `Account "${id}" not found` });

  try {
    const feed = await parser.parseURL(account.rssUrl);

    const raw = (feed.items || [])
      .slice(0, 20)
      .map((item) => {
        const image =
          item.mediaContent?.["$"]?.url ||
          item.mediaContent?.url ||
          null;

        const text =
          item.title && item.title !== "Image"
            ? item.title
            : null;

        return {
          id: item.guid || item.link,
          text,
          createdAt:
            item.isoDate ||
            item.pubDate ||
            new Date().toISOString(),
          image,
          url:
            item.link ||
            `https://x.com/${account.handle}`,
        };
      })
      .filter((t) => t.text || t.image);

    // === TRANSLATION WITH CACHE ===

    const withText = raw.filter((t) => t.text);

    // Only translate uncached ones
    const toTranslate = withText.filter((t) => {
      const key = getCacheKey(t.text);
      return !translationCache.has(key);
    });

    if (toTranslate.length > 0) {
      const texts = toTranslate.map((t) => t.text);

      const translated = await translateTexts(texts);

      toTranslate.forEach((tweet, i) => {
        const key = getCacheKey(tweet.text);

        const textEn =
          translated[i] !== tweet.text
            ? translated[i]
            : null;

        translationCache.set(key, textEn);
      });
    }

    // Apply cached translations
    const tweets = raw.map((t) => {
      if (!t.text) {
        return { ...t, textEn: null };
      }

      const key = getCacheKey(t.text);
      const cached = translationCache.get(key);

      return {
        ...t,
        textEn: cached || null,
      };
    });

    const profileImage =
      account.profileImage || feed.image?.url || null;

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
    console.error(
      `tweets RSS fetch failed for ${id}:`,
      e.message
    );
    return res.status(500).json({ error: e.message, tweets: [] });
  }
}