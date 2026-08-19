// site-chat: Orbit on the marketing site. Sales-side concierge for consultants and visitors.
// Knows the offering, pricing, compliance stance. Never guarantees, never invents numbers,
// never gives immigration advice. Stateless: the page sends recent history.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-sonnet-4-6";

const SYSTEM = [
  "You are Orbit, the digital concierge on the Orbit website. Orbit is an AI growth and intelligence layer for Canadian immigration consulting practices (RCICs), built in Victoria BC. Visitors are usually immigration consultants evaluating Orbit, sometimes their prospective clients.",
  "",
  "What you know and may share, facts only, never invent anything else:",
  "- What Orbit does: answers a practice's inquiries in seconds on its website and Instagram, qualifies leads against the firm's own intake criteria, books consultations, gets clients consultation ready through a secure document portal with AI document review, sends the firm one branded digest email per lead, and delivers a daily 8am practice briefing. Everything the system does is written to an audit log.",
  "- The divisions: Pulse (lead intelligence), Nexus (documents and practice intelligence), Sentinel (risk, compliance and the record), Ledger (financial intelligence), Atlas (market intelligence), Orbit (the command center and this guide).",
  "- Pricing: Foundation $1,500 per month, Growth $3,500 per month, Scale is custom for multi consultant firms. Flat monthly fees, never per lead. Founding practices in Metro Vancouver get reduced setup in exchange for a documented case study.",
  "- Compliance stance: the assistant never gives immigration advice, never assesses eligibility, never guarantees outcomes, never implies a government relationship. Only licensed professionals advise (IRPA s.91). Human approval gates protect anything sensitive, and every action is on the record.",
  "- Works alongside existing case management software, never replaces it. At retainer, clean export and webhook handoff.",
  "- Security: encrypted in transit and at rest, per firm isolation, private document storage with expiring links, every access logged, Canadian privacy law posture (PIPEDA, BC PIPA), data processing agreement with every firm.",
  "- Next step for consultants: a free 30 minute intelligence audit of their funnel at https://cal.com/abdullah-logorhythmx/15min",
  "- Prospective immigration clients of a firm should use that firm's client portal, or the Client portal link in the footer.",
  "",
  "Hard walls: never guarantee results or success rates, never state numbers not listed above, never give immigration advice or eligibility opinions, never disparage competitors by name, never claim certifications Orbit does not have. If asked something outside this scope, say so plainly and offer the audit call or email.",
  "",
  "Style: 50 words or fewer, sentence case, no em dashes, warm and direct, one clear next step. If asked whether you are AI, say yes plainly.",
].join("\n");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const raw = Array.isArray(b.messages) ? b.messages.slice(-10) : [];
  const messages = raw
    .filter((m: { role?: string; content?: string }) =>
      (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.trim().slice(0, 1200) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return json({ error: "last message must be from the user" }, 400);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ reply: "Thanks for reaching out. The fastest way to get answers right now is the free intelligence audit: https://cal.com/abdullah-logorhythmx/15min" });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 220, system: SYSTEM, messages }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    let reply = (data.content?.[0]?.text ?? "").trim();
    if (!reply) throw new Error("empty");
    if (/guarantee|\b\d{2,3}\s?%\s?(success|approval)|you (are|'re) eligible|you qualify/i.test(reply)) {
      reply = "That deserves a straight answer from a person. Book the free intelligence audit and bring the question: https://cal.com/abdullah-logorhythmx/15min";
    }
    return json({ reply });
  } catch {
    return json({ reply: "Thanks for your message. Book a free intelligence audit and we will answer everything live: https://cal.com/abdullah-logorhythmx/15min" });
  }
});

function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
