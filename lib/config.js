// ============================================================
//  CONFIG — edit this file to add/change streams and feeds
// ============================================================

export const CHANNELS = [
  {
    id: "m1",
    name: "M1",
    logo: "M1",
    color: "#2e7d32",
    stream: "",            // left empty — URL is fetched dynamically via /api/stream-token
    tokenChannel: "m1",   // triggers fresh token fetch from mediaklikk player API
  },
  {
  id: "atv",
  name: "ATV",
  logo: "ATV",
  color: "#c62828",
  stream: "https://atv-proxy-1.onrender.com/stream/channel/79a8c00f96580b33b6599b9651cf89eb?profile=webtv-h264-aac-matrosk",
},
  {
    id: "rtl",
    name: "RTL",
    logo: "RTL",
    color: "#e65100",
    stream: "", // ← paste RTL .m3u8 URL here when ready
  },
  {
    id: "ch4",
    name: "Channel 4",
    logo: "CH4",
    color: "#4527a0",
    stream: "", // ← future channel
  },
];

export const RSS_FEEDS = [
  { url: "https://444.hu/feed",                                          source: "444.hu",     lang: "hu", category: "politics" },
  { url: "https://telex.hu/rss",                                         source: "Telex",      lang: "hu", category: "politics" },
  { url: "https://index.hu/24ora/rss/",                                  source: "Index",      lang: "hu", category: "politics" },
  { url: "https://hirado.hu/hirado.aspx",                                source: "Híradó",     lang: "hu", category: "politics" },
  { url: "https://www.atv.hu/feed/",                                     source: "ATV",        lang: "hu", category: "politics" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml",     source: "NYT Europe", lang: "en", category: "international" },
  { url: "https://www.politico.eu/feed/",                                source: "Politico EU",lang: "en", category: "international" },
];

export const SOCIAL_ACCOUNTS = {
  twitter: [
    { handle: "magyarpeterMP", label: "Magyar Péter",  color: "#1565c0" },
    { handle: "PM_ViktorOrban", label: "Viktor Orbán", color: "#b71c1c" },
  ],
  facebook: [
    { pageUrl: "https://www.facebook.com/magyartisza",  label: "Magyar Tisza Párt" },
    { pageUrl: "https://www.facebook.com/FideszHU",     label: "Fidesz" },
  ],
};

export const DEFAULT_KEYWORDS = [
  "választás", "koalíció", "Orbán", "Magyar Péter", "Fidesz", "ellenzék",
  "szavazás", "eredmény", "mandátum", "government", "election", "coalition",
];

export const REFRESH_INTERVAL_MS = 90_000; // 90 seconds

export const LIBRETRANSLATE_URL = process.env.NEXT_PUBLIC_LIBRETRANSLATE_URL || "https://libretranslate.com";
