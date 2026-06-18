// api/chat.js
// Vercel serverless function. This is the ONLY place your OpenAI key lives.
// The Qualtrics survey calls this endpoint; this endpoint calls OpenAI.
// The participant's browser never sees your key.
 
// ---- Configuration (set these in the Vercel dashboard, not here) ----
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;            // required
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";      // cheap + capable default
const MAX_TURNS = parseInt(process.env.MAX_TURNS || "8", 10); // server-enforced turn cap
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "400", 10);
 
// The chatbot's instructions live HERE on the server, not in the survey.
// Participants can't see or override them. Edit these to fit your study.
//
// Each KEY is a condition label that the survey sends (e.g. "good" / "bad").
// The survey never sends the prompt TEXT, only the label, so participants
// cannot read which condition they are in.
const PROMPTS = {
  good:
    process.env.PROMPT_GOOD ||
    "You are a warm, attentive, and helpful conversational partner. " +
    "Listen carefully, answer thoughtfully, and keep replies to a few sentences.",
  bad:
    process.env.PROMPT_BAD ||
    "You are a curt, dismissive conversational partner. " +
    "Give short, unhelpful replies and show little interest. Keep replies to a few sentences.",
};
 
// Used when the survey sends no condition or an unrecognized one.
const DEFAULT_CONDITION = "good";
 
// ---- CORS: allow your Qualtrics survey to call this endpoint ----
// Qualtrics surveys run on subdomains of qualtrics.com. We reflect the
// request origin only if it is a qualtrics.com domain.
function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowed = /^https:\/\/([a-z0-9-]+\.)*qualtrics\.com$/i.test(origin);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
 
export default async function handler(req, res) {
  setCors(req, res);
 
  // Browser preflight check
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Server not configured: missing OPENAI_API_KEY" });
  }
 
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const clientMessages = Array.isArray(body.messages) ? body.messages : [];
 
    // ---- Server-side guardrails ----
    // 1. Drop anything except user/assistant turns (ignore client-sent system
    //    or other roles so the prompt can't be hijacked).
    const cleaned = clientMessages
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })); // cap length
 
    // 2. Enforce the turn cap on the server too (client also enforces it).
    const userTurns = cleaned.filter((m) => m.role === "user").length;
    if (userTurns > MAX_TURNS) {
      return res.status(429).json({ error: "Turn limit reached" });
    }
 
    // 3. Pick the system prompt from the condition label the survey sent.
    //    Unknown/missing labels fall back to the default condition.
    var condition = typeof body.condition === "string" ? body.condition.trim() : "";
    var systemPrompt = PROMPTS[condition] || PROMPTS[DEFAULT_CONDITION];
    console.log("condition:", condition || "(none)"); // shows in Vercel logs
 
    // 4. Prepend the trusted system prompt.
    const messages = [{ role: "system", content: systemPrompt }, ...cleaned];
 
    // ---- Call OpenAI ----
    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
      }),
    });
 
    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      console.error("OpenAI error:", openaiResp.status, errText);
      return res.status(502).json({ error: "Upstream model error" });
    }
 
    const data = await openaiResp.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "";
 
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}