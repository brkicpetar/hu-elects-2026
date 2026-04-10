import Parser from "rss-parser";
import { RSS_FEEDS } from "../../lib/config";

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
      if (similarity(art.title, other.title) > 0.45) { cluster.push(j); clustered.add(j); }
    });
    clustered.add(i);
    clusters.push(cluster);
  });

  let finalArticles = clusters.map((cluster, ci) => {
    const primary = articles[cluster[0]];
    return { ...primary, cluster: ci, clusterSize: cluster.length, clusterSources: cluster.map((idx) => articles[idx].source) };
  });

  // Only translate Hungarian articles; English sources (NYT, Politico) are skipped
  const huArticles = finalArticles.filter((a) => a.lang === "hu");

  if (huArticles.length > 0) {
    const titles = huArticles.map((a) => a.title);
    const summaries = huArticles.map((a) => a.summary.slice(0, 300));

    const [translatedTitles, translatedSummaries] = await Promise.all([
      translateTexts(titles),
      translateTexts(summaries),
    ]);

    huArticles.forEach((art, i) => {
      art.titleEn = translatedTitles[i] !== art.title ? translatedTitles[i] : null;
      art.summaryEn = translatedSummaries[i] !== art.summary ? translatedSummaries[i] : null;
    });
  }

  res.json({ articles: finalArticles, fetchedAt: new Date().toISOString() });
}
