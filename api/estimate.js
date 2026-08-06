// Vercel serverless function.
// Keeps your Anthropic API key on the server so it never reaches the browser.
//
// Setup (all in the browser, no terminal needed):
//   1. Get a key at https://console.anthropic.com  (API keys → Create key)
//   2. In Vercel: your project → Settings → Environment Variables
//      add   ANTHROPIC_API_KEY = sk-ant-...   then redeploy.
//
// The frontend posts { system, user } to /api/estimate and gets back the raw
// Anthropic response (with its content array), which App.jsx already parses.
//
// Vercel kills functions after 10s by default — too short once you log more
// than a food or two. This raises the cap to 60s (max on Hobby).
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "Server is missing ANTHROPIC_API_KEY. Add it in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { system, user, model, max_tokens, tools, tool_choice } = body || {};
  if (!user) return res.status(400).json({ error: "Missing 'user' text." });

  const payload = {
    model: model || "claude-sonnet-5", // parse calls pass a faster model; see App.jsx
    max_tokens: max_tokens || 2000,
    system: system || "",
    messages: [{ role: "user", content: user }],
  };
  if (tools) payload.tools = tools;
  if (tool_choice) payload.tool_choice = tool_choice;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ("Anthropic API error (" + r.status + ").");
      return res.status(r.status).json({ error: msg });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: "Could not reach the nutrition estimator. Try again in a moment." });
  }
}
