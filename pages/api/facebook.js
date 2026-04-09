// api/facebook.js
// Fetches posts from a Facebook Page via the Graph API.
// Usage: GET /api/facebook?id=tisza  (id must match FACEBOOK_PAGES in config)
//
// Requires FACEBOOK_PAGE_ACCESS_TOKEN in .env.local
// See .env.example for full setup instructions.

import { FACEBOOK_PAGES } from "../../lib/config";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const page = FACEBOOK_PAGES.find((p) => p.id === id);
  if (!page) return res.status(404).json({ error: `Page "${id}" not found in config` });

  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) {
    return res.status(503).json({
      error: "FACEBOOK_PAGE_ACCESS_TOKEN not configured. See .env.example for instructions.",
      posts: [],
    });
  }

  try {
    const fields = "id,message,story,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true),shares";
    const url =
      `https://graph.facebook.com/v19.0/${encodeURIComponent(page.pageId)}/posts` +
      `?fields=${encodeURIComponent(fields)}` +
      `&limit=12` +
      `&access_token=${token}`;

    const fbRes = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!fbRes.ok) {
      const err = await fbRes.text();
      console.error(`Facebook Graph API error for ${page.pageId}:`, fbRes.status, err);
      return res.status(fbRes.status).json({ error: "Graph API request failed", posts: [] });
    }

    const fbData = await fbRes.json();

    if (fbData.error) {
      return res.status(400).json({ error: fbData.error.message, posts: [] });
    }

    // Also fetch page name/picture
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(page.pageId)}?fields=name,picture&access_token=${token}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const metaData = metaRes.ok ? await metaRes.json() : {};

    const posts = (fbData.data || []).map((p) => ({
      id: p.id,
      text: p.message || p.story || "",
      createdAt: p.created_time,
      image: p.full_picture || null,
      url: p.permalink_url || `https://www.facebook.com/${page.pageId}`,
      likes: p.likes?.summary?.total_count ?? 0,
      comments: p.comments?.summary?.total_count ?? 0,
      shares: p.shares?.count ?? 0,
    }));

    return res.json({
      id: page.id,
      label: metaData.name || page.label,
      pageImage: metaData.picture?.data?.url || null,
      color: page.color,
      posts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`facebook handler error for ${id}:`, e.message);
    return res.status(500).json({ error: e.message, posts: [] });
  }
}
