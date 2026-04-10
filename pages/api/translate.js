// api/translate.js
// Translates an array of texts from Hungarian to English using Claude.
// Texts already in English are returned as-is (Claude detects automatically).
// Called by news.js, tweets.js, and facebook.js
//
// POST body: { texts: string[] }
// Response:  { translated: string[] }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { texts } = req.body;
  if (!Array.isArray(texts) || texts.length === 0) {
    return res.json({ translated: [] });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Graceful fallback — return originals untranslated
    return res.json({ translated: texts });
  }

  try {
    // Build a numbered list so Claude can return aligned results
    const numbered = texts
      .map((t, i) => `[${i + 1}] ${(t || "").slice(0, 400)}`)
      .join("\n");

    const prompt = `You are a translator. Below is a numbered list of texts, each prefixed with [N].
Some are in Hungarian, some may already be in English or contain mixed language.

Rules:
- Translate Hungarian text to English.
- If a text is already in English, return it exactly as-is.
- Keep proper nouns, party names, and place names as-is (e.g. Fidesz, TISZA, Orbán).
- Return ONLY a JSON array of translated strings, in the same order, same count as input.
- No explanation, no markdown, no extra text. Just the JSON array.

Texts:
${numbered}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.status, await response.text());
      return res.json({ translated: texts }); // fallback to originals
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || "[]";

    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, "").trim();
    const translated = JSON.parse(clean);

    if (!Array.isArray(translated) || translated.length !== texts.length) {
      console.error("Translation response length mismatch", translated.length, "vs", texts.length);
      return res.json({ translated: texts });
    }

    return res.json({ translated });
  } catch (e) {
    console.error("translate handler error:", e.message);
    return res.json({ translated: texts }); // always fall back gracefully
  }
}
