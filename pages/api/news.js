import Parser from "rss-parser";
import { RSS_FEEDS, LIBRETRANSLATE_URL } from "../../lib/config";

const parser = new Parser({
  customFields: {
    item: [["media:content", "mediaContent"], ["media:thumbnail", "mediaThumbnail"], ["enclosure", "enclosure"]],
  },
});

function similarity(a, b) {
  const normalize = (s) => s.toLowerCase().replace(/[^a-záéíóöőúüű\s]/gi, "").trim();
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  const wordsA = new Set(na.split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(/\s+/).filter((w) => w.length > 3));
  if (!wordsA.size) return 0;
  let shared = 0;
  wordsA.forEach((w) => { if (wordsB.has(w)) shared++; });
  return shared / Math.max(wordsA.size, wordsB.size);
}

function extractThumbnail(item) {
  if (item.mediaContent?.["$"]?.url) return item.mediaContent["$"].url;
  if (item.mediaThumbnail?.["$"]?.url) return item.mediaThumbnail["$"].url;
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image")) return item.enclosure.url;
  const match = (item["content:encoded"] || item.content || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

async function translateTexts(texts, sourceLang) {
  if (!texts.length || !LIBRETRANSLATE_URL) return null;
  try {
    const res = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: texts, source: sourceLang, target: "en", format: "text" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("LibreTranslate error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return Array.isArray(data.translatedText) ? data.translatedText : null;
  } catch (e) {
    console.error("Translation failed:", e.message);
    return null;
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
          pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
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

  let articles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
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

  // Translate Hungarian articles in small batches to avoid timeout
  const huArticles = finalArticles.filter((a) => a.lang === "hu");
  
  if (huArticles.length > 0) {
    // Split into batches of 10 to avoid LibreTranslate timeouts
    const batchSize = 10;
    for (let i = 0; i < huArticles.length; i += batchSize) {
      const batch = huArticles.slice(i, i + batchSize);
      const titles = batch.map((a) => a.title);
      const summaries = batch.map((a) => a.summary.slice(0, 300));

      const [titleTranslations, summaryTranslations] = await Promise.all([
        translateTexts(titles, "hu"),
        translateTexts(summaries, "hu"),
      ]);

      batch.forEach((art, j) => {
        art.titleEn = titleTranslations?.[j] || null;
        art.summaryEn = summaryTranslations?.[j] || null;
      });
    }
  }

  res.json({ articles: finalArticles, fetchedAt: new Date().toISOString() });
}
