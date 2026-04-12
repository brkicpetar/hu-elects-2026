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
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image"))
    return item.enclosure.url;
  const match = (item["content:encoded"] || item.content || "").match(
    /<img[^>]+src=["']([^"']+)["']/i
  );
  return match ? match[1] : null;
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/rss+xml, application/xml, text/xml, */*",
      "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parser.parseString(xml);
}

async function translateOne(text, sl = "hu") {
  if (!text || !text.trim()) return text;
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=en&dt=t&q=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return text;
    const data = await res.json();
    return data[0]?.map((chunk) => chunk[0]).join("") || text;
  } catch {
    return text;
  }
}

async function translateAll(texts, sl = "hu", concurrency = 4) {
  const results = new Array(texts.length).fill(null);
  for (let i = 0; i < texts.length; i += concurrency) {
    const slice = texts.slice(i, i + concurrency);
    const done = await Promise.all(slice.map((t) => translateOne(t, sl)));
    done.forEach((val, j) => { results[i + j] = val; });
  }
  return results;
}

function buildArticles(items, feed) {
  return items.slice(0, 15).map((item) => ({
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
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Split feeds: server-fetchable vs client-side (Cloudflare-protected)
  const serverFeeds = RSS_FEEDS.filter((f) => !f.clientSide);
  const clientFeeds = RSS_FEEDS.filter((f) => f.clientSide);

  // Fetch server-side feeds normally
  const serverResults = await Promise.allSettled(
    serverFeeds.map(async (feed) => {
      try {
        const parsed = await fetchFeed(feed);
        return buildArticles(parsed.items, feed);
      } catch (e) {
        console.error(`Feed ${feed.source} failed:`, e.message);
        return [];
      }
    })
  );

  let articles = serverResults.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  // If client sent pre-fetched articles for client-side feeds, merge them in
  if (req.method === "POST") {
    try {
      const body = req.body;
      if (body?.clientArticles && Array.isArray(body.clientArticles)) {
        articles = [...articles, ...body.clientArticles];
      }
    } catch {}
  }

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
    return {
      ...primary,
      cluster: ci,
      clusterSize: cluster.length,
      clusterSources: cluster.map((idx) => articles[idx].source),
    };
  });

  // Translation
  const huArticles = finalArticles.filter((a) => a.lang === "hu");
  const toTranslate = huArticles.filter((a) => !translationCache.has(getCacheKey(a)));

  if (toTranslate.length > 0) {
    const titles    = toTranslate.map((a) => a.title);
    const summaries = toTranslate.map((a) => a.summary.slice(0, 300));

    const [translatedTitles, translatedSummaries] = await Promise.all([
      translateAll(titles, "hu", 4),
      translateAll(summaries, "hu", 4),
    ]);

    toTranslate.forEach((art, i) => {
      translationCache.set(getCacheKey(art), {
        titleEn:   translatedTitles[i]   !== art.title   ? translatedTitles[i]   : null,
        summaryEn: translatedSummaries[i] !== art.summary ? translatedSummaries[i] : null,
      });
    });
  }

  huArticles.forEach((art) => {
    const cached = translationCache.get(getCacheKey(art));
    if (cached) { art.titleEn = cached.titleEn; art.summaryEn = cached.summaryEn; }
  });

  // Tell client which feeds it needs to fetch itself
  res.json({
    articles: finalArticles,
    clientFeeds: clientFeeds.map((f) => ({ url: f.url, source: f.source, lang: f.lang, category: f.category })),
    fetchedAt: new Date().toISOString(),
  });
}
