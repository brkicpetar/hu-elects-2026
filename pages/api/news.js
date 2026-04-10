import Parser from "rss-parser";
import crypto from "crypto";
import { RSS_FEEDS } from "../../lib/config";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["enclosure", "enclosure"],
    ],
  },
});

// In-memory translation cache
// key: hash(title + summary)
// value: { titleEn, summaryEn }
const translationCache = new Map();

function getCacheKey(article) {
  return crypto
    .createHash("md5")
    .update((article.title || "") + (article.summary || ""))
    .digest("hex");
}

function similarity(a, b) {
  const normalize = (s) =>
    s.toLowerCase().replace(/[^a-záéíóöőúüű\s]/gi, "").trim();

  const na = normalize(a),
    nb = normalize(b);
  if (!na || !nb) return 0;

  const wordsA = new Set(na.split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(/\s+/).filter((w) => w.length > 3));

  if (!wordsA.size) return 0;

  let shared = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) shared++;
  });

  return shared / Math.max(wordsA.size, wordsB.size);
}

function extractThumbnail(item) {
  if (item.mediaContent?.["$"]?.url) return item.mediaContent["$"].url;
  if (item.mediaThumbnail?.["$"]?.url) return item.mediaThumbnail["$"].url;
  if (
    item.enclosure?.url &&
    item.enclosure.type?.startsWith("image")
  )
    return item.enclosure.url;

  const match = (item["content:encoded"] || item.content || "").match(
    /<img[^>]+src=["']([^"']+)["']/i
  );

  return match ? match[1] : null;
}

async function translateTexts(texts) {
  if (!texts.length) return texts;

  try {
    const query = encodeURIComponent(texts.join("\n"));

    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${query}`
    );

    if (!res.ok) return texts;

    const data = await res.json();

    return data[0].map((item) => item[0]);
  } catch (e) {
    console.error("translateTexts failed:", e.message);
    return texts;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);

        return parsed.items.slice(0, 15).map((item) => ({
          id: item.guid || item.link || item.title,
          title: item.title || "",
          summary: item.contentSnippet || item.summary || "",
          link: item.link || "",
          pubDate:
            item.isoDate || item.pubDate || new Date().toISOString(),
          thumbnail: extractThumbnail(item),
          source: feed.source,
          lang: feed.lang,
          category: feed.category,
          titleEn: null,
          summaryEn: null,
          cluster: null,
        }));
      } catch (e) {
        console.error(`Feed ${feed.source} failed:`, e.message);
        return [];
      }
    })
  );

  let articles = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );

  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Deduplication clustering
  const clusters = [];
  const clustered = new Set();

  articles.forEach((art, i) => {
    if (clustered.has(i)) return;

    const cluster = [i];

    articles.forEach((other, j) => {
      if (i === j || clustered.has(j)) return;

      if (similarity(art.title, other.title) > 0.45) {
        cluster.push(j);
        clustered.add(j);
      }
    });

    clustered.add(i);
    clusters.push(cluster);
  });

  let finalArticles = clusters.map((cluster, ci) => {
    const primary = articles[cluster[0]];

    return {
      ...primary,
      cluster: ci,
      clusterSize: cluster.length,
      clusterSources: cluster.map((idx) => articles[idx].source),
    };
  });

  // === TRANSLATION WITH CACHE ===
  const huArticles = finalArticles.filter((a) => a.lang === "hu");

  // Find untranslated articles
  const toTranslate = huArticles.filter((a) => {
    const key = getCacheKey(a);
    return !translationCache.has(key);
  });

  if (toTranslate.length > 0) {
    const titles = toTranslate.map((a) => a.title);
    const summaries = toTranslate.map((a) =>
      a.summary.slice(0, 300)
    );

    const [translatedTitles, translatedSummaries] =
      await Promise.all([
        translateTexts(titles),
        translateTexts(summaries),
      ]);

    toTranslate.forEach((art, i) => {
      const key = getCacheKey(art);

      const titleEn =
        translatedTitles[i] !== art.title
          ? translatedTitles[i]
          : null;

      const summaryEn =
        translatedSummaries[i] !== art.summary
          ? translatedSummaries[i]
          : null;

      translationCache.set(key, { titleEn, summaryEn });
    });
  }

  // Apply cached translations
  huArticles.forEach((art) => {
    const key = getCacheKey(art);
    const cached = translationCache.get(key);

    if (cached) {
      art.titleEn = cached.titleEn;
      art.summaryEn = cached.summaryEn;
    }
  });

  res.json({
    articles: finalArticles,
    fetchedAt: new Date().toISOString(),
  });
}