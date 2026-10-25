export const CHANNELS = [
  { id: "rts",    name: "RTS 1",     logo: "RTS 1",    color: "#BB0335", streamType: "hls",    stream: "https://rts-live.morescreens.com/RTS_1_001/playlist.m3u8?id=RTS_1_001&video_id=5&token=a1578bc0682ca6e56ac952aa2b89f184ee7ed714&authority_instance_id=spectar-prd-rts&profile_id=2700385&application_installation_id=13281943&uuid=5f3d798081e398-93563825&subscriber_id=2527996&application_id=helium&detected_delivery_method=hls&playlist_template=nginx" },
  { id: "rtv",   name: "RTV 1",    logo: "RTV 1",   color: "#59E3F0", streamType: "hls",    stream: "https://atv-proxy-1.onrender.com/hls/RTV/rtv1/playlist.m3u8" },
  { id: "kurir", name: "Kurir TV",  logo: "Kurir TV", color: "#F09D25", streamType: "hls",    stream: "https://static.am.mediaoutcast.com/storage/nQJnjJkO/nQJnjJkO/stream/O68x4o8g/index.m3u8" },
  { id: "n1", name: "N1", logo: "N1", color: "#012370", streamType: "hls",    stream: "https://nova-proxy-e1tn.onrender.com/n1" },
];

export const RSS_FEEDS = [
  { url: "https://www.tanjug.rs/rss/srbija/politika",                  source: "Tanjug",      lang: "rs", category: "government",   clientSide: false },
  { url: "https://n1info.rs/feed/",                                    source: "N1",       lang: "rs", category: "independent",   clientSide: false },
  { url: "https://www.blic.rs/rss/Vesti/Politika",                     source: "Blic",       lang: "rs", category: "government",    clientSide: false },
  { url: "https://informer.rs/rss/politika/vesti",                     source: "Informer",      lang: "rs", category: "government",    clientSide: false },
  { url: "https://nova.rs/feed/",                                         source: "Nova S",       lang: "rs", category: "independent",   clientSide: false },
  { url: "https://insajder.net/feed",                                     source: "Insajder",    lang: "hu", category: "independent",    clientSide: false },
  { url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml",     source: "BBC",  lang: "en", category: "international", clientSide: false },
  { url: "https://beta.rs/rss",                               source: "Beta", lang: "rs", category: "independent", clientSide: false },
];

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
    profileImage: "https://pbs.twimg.com/profile_images/1578320074670227457/DumKdAJQ_400x400.jpg",
  },
];

export const FACEBOOK_PAGES = [
  {
    id: "magyartisza",
    label: "Tisza Párt",
    color: "#1565c0",
    logoUrl: "https://i.imgur.com/e0Je8nx.png",
    rssUrl: "https://rss.app/feeds/qukVheHNYLM7M8S6.xml",
  },
  {
    id: "fideszhu",
    label: "Fidesz",
    color: "#ff6b01",
    logoUrl: "https://i.imgur.com/mDJJANk.png",
    rssUrl: "https://rss.app/feeds/7Go4NX3PrU7pZwlz.xml",
  },
];

export const DEFAULT_KEYWORDS = [
  // Engleski
  "student list", "election", "Serbia", "vote", "Belgrade", "Vucic", "students"
];

export const REFRESH_INTERVAL_MS = 90_000;
