// ============================================================
//  CONFIG — edit this file to add/change streams and feeds
// ============================================================

export const CHANNELS = [
  {
    id: "m1",
    name: "M1",
    logo: "M1",
    color: "#2e7d32",
    stream: "https://atv-proxy-1.onrender.com/m1",
  },
  {
    id: "atv",
    name: "ATV",
    logo: "ATV",
    color: "#c62828",
    stream: "https://atv-proxy-1.onrender.com/stream",
  },
  {
    id: "rtl",
    name: "RTL",
    logo: "RTL",
    color: "#e65100",
    stream: "",
  },
  {
    id: "hirtv",
    name: "HirTV",
    logo: "HirTV",
    color: "#4527a0",
    stream: "https://video3.videa.hu/static/live/8.2966061.2530409.1.5.590.590/index.m3u8",
  },
];

export const RSS_FEEDS = [
  { url: "https://444.hu/feed",                                         source: "444.hu",      lang: "hu", category: "politics" },
  { url: "https://telex.hu/rss",                                        source: "Telex",       lang: "hu", category: "politics" },
  { url: "https://index.hu/24ora/rss/",                                 source: "Index",       lang: "hu", category: "politics" },
  { url: "https://hirado.hu/hirado.aspx",                               source: "Híradó",      lang: "hu", category: "politics" },
  { url: "https://www.atv.hu/feed/",                                    source: "ATV",         lang: "hu", category: "politics" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml",    source: "NYT Europe",  lang: "en", category: "international" },
  { url: "https://www.politico.eu/feed/",                               source: "Politico EU", lang: "en", category: "international" },
];

// ── Twitter/X feeds via rss.app (no API key needed) ────────────────────────
export const TWITTER_ACCOUNTS = [
  {
    id: "magyar",
    handle: "magyarpeterMP",
    label: "Magyar Péter",
    color: "#1565c0",
    rssUrl: "https://rss.app/feeds/mv6EgUMpLHVmC6W7.xml",
    profileImage: "https://pbs.twimg.com/profile_images/1854489809105862661/yLGiOKGL_400x400.jpg",
  },
  {
    id: "orban",
    handle: "PM_ViktorOrban",
    label: "Viktor Orbán",
    color: "#b71c1c",
    rssUrl: "https://rss.app/feeds/stLPnydfwz7upgi1.xml",
    profileImage: "https://pbs.twimg.com/profile_images/1578320074670227457/DumKdAJQ_400x400.jpg", // will be fetched from RSS feed image if available
  },
];

// ── Facebook Pages via Graph API ───────────────────────────────────────────
// Requires FACEBOOK_PAGE_ACCESS_TOKEN in .env.local
// See .env.example for setup instructions
export const FACEBOOK_PAGES = [
  {
    id: "tisza",
    pageId: "magyartisza",
    label: "Tisza Párt",
    color: "#1565c0",
    rssUrl: "https://rss.app/feeds/qukVheHNYLM7M8S6.xml",
  },
  {
    id: "fidesz",
    pageId: "FideszHU",
    label: "Fidesz",
    color: "#b71c1c",
    rssUrl: "https://rss.app/feeds/7Go4NX3PrU7pZwlz.xml",
  },
];

export const DEFAULT_KEYWORDS = [
  "választás", "koalíció", "Orbán", "Magyar Péter", "Fidesz", "ellenzék",
  "szavazás", "eredmény", "mandátum", "government", "election", "coalition",
];

export const REFRESH_INTERVAL_MS = 90_000; // 90 seconds
