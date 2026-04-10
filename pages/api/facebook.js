import Parser from "rss-parser";
import { FACEBOOK_PAGES } from "../../lib/config";

const parser = new Parser({
  customFields: {
    item: [["media:content", "mediaContent"], ["media:thumbnail", "mediaThumbnail"], ["enclosure", "enclosure"]],
  },
});

function extractImage(item) {
  if (item.mediaContent?.["$"]?.url) return item.mediaContent["$"].url;
  if (item.mediaThumbnail?.["$"]?.url) return item.mediaThumbnail["$"].url;
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image")) return item.enclosure.url;
  const html = item["content:encoded"] || item.content || item.summary || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n").trim();
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
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const page = FACEBOOK_PAGES.find((p) => p.id === id);
  if (!page) return res.status(404).json({ error: `Page "${id}" not found` });

  if (!page.rssUrl || page.rssUrl.startsWith("PASTE_")) {
    return res.status(503).json({ error: `RSS URL for "${page.label}" not configured`, posts: [] });
  }

  try {
    const feed = await parser.parseURL(page.rssUrl);

    const rawPosts = (feed.items || []).slice(0, 12).map((item) => ({
      id: item.guid || item.link || item.title,
      text: stripHtml(item["content:encoded"] || item.content || item.contentSnippet || item.title || ""),
      createdAt: item.isoDate || item.pubDate || new Date().toISOString(),
      image: extractImage(item),
      url: item.link || page.pageUrl || "#",
    }));

    // Translate all post texts
    const texts = rawPosts.map((p) => p.text || "");
    const translated = await translateTexts(texts);

    const posts = rawPosts.map((p, i) => ({
      ...p,
      textEn: translated[i] && translated[i] !== p.text ? translated[i] : null,
    }));

    return res.json({
      id: page.id,
      label: page.label,
      color: page.color,
      logoUrl: page.logoUrl,
      posts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`facebook RSS failed for ${id}:`, e.message);
    return res.status(500).json({ error: e.message, posts: [] });
  }
}
