// site-chat: Orbit on the marketing site. Sales-side concierge for consultants and visitors.
// Knows the offering, pricing, compliance stance. Never guarantees, never invents numbers,
// never gives immigration advice. Every conversation is captured as a lead against orbit-hq
// itself, this is Orbit's own top-of-funnel, so a real visitor's interest is never dropped.
import { createClient } from "npm:@supabase/supabase-js@2";
import { withinRateLimit, clientKey } from "../_shared/rate-limit.ts";
import { violatesOutputGuard } from "../_shared/compliance-guard.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-sonnet-4-6";
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

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
  "- Next step for consultants: a free 30 minute intelligence audit of their funnel at https://cal.com/abdullah-logorhythmx/15min, or the free Lead Leak Report, upload your old inquiries and see where they went, no commitment.",
  "- Prospective immigration clients of a firm should use that firm's client portal, or the Client portal link in the footer.",
  "",
  "Hard walls: never guarantee results or success rates, never state numbers not listed above, never give immigration advice or eligibility opinions, never disparage competitors by name, never claim certifications Orbit does not have. If asked something outside this scope, say so plainly and offer the audit call or email.",
  "",
  "Style: 50 words or fewer, sentence case, no em dashes, warm and direct, one clear next step. If asked whether you are AI, say yes plainly.",
  "",
  "Language: reply fluently in whatever language the visitor writes in. Immigration to Canada draws heavily from Hindi, Punjabi, Mandarin, Cantonese, Tagalog, Spanish, Vietnamese, Korean, Arabic, French and Portuguese speakers, so treat fluency in these as a baseline, not an edge case. Match their language exactly, do not switch to English unless they do. All the same hard walls above apply in every language, translation is never an excuse to soften them.",
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
  const visitorId = typeof b.visitor_id === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(b.visitor_id) ? b.visitor_id : null;
  const userText = messages[messages.length - 1].content;

  const ok = await withinRateLimit(sb, "site-chat", clientKey(req), 30, 600);
  if (!ok) return json({ reply: "You have sent a lot of messages quickly. Please wait a few minutes, or book the audit call directly: https://cal.com/abdullah-logorhythmx/15min" }, 429);

  // Capture this visitor as a lead against orbit-hq itself, Orbit's own
  // top-of-funnel. Only the newest exchange is written per call, avoiding
  // duplicate rows since the page resends prior history each time.
  let leadId: string | null = null;
  if (visitorId) {
    const { data: org } = await sb.from("organizations").select("id").eq("slug", "orbit-hq").maybeSingle();
    if (org) {
      const { data: existing } = await sb.from("leads").select("id, email")
        .eq("org_id", org.id).eq("source", "website").eq("external_id", visitorId).maybeSingle();
      const emailMatch = userText.match(EMAIL_RE);
      if (existing) {
        leadId = existing.id;
        if (emailMatch && !existing.email) {
          await sb.from("leads").update({ email: emailMatch[0] }).eq("id", leadId);
          await notifyNewSiteLead(org.id, leadId, emailMatch[0], userText);
        }
      } else {
        const { data: created } = await sb.from("leads").insert({
          org_id: org.id, source: "website", external_id: visitorId,
          email: emailMatch ? emailMatch[0] : null, stage: "new",
          service_interest: "orbit_platform",
        }).select("id").single();
        leadId = created?.id ?? null;
        if (leadId) {
          await sb.from("lead_events").insert({ org_id: org.id, lead_id: leadId, type: "site_chat_started", payload: {} });
          if (emailMatch) await notifyNewSiteLead(org.id, leadId, emailMatch[0], userText);
        }
      }
      if (leadId) {
        await sb.from("communications").insert({
          org_id: org.id, lead_id: leadId, channel: "website", direction: "inbound",
          body: userText, status: "received",
        });
      }
    }
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    const fallback = "Thanks for reaching out. The fastest way to get answers right now is the free intelligence audit: https://cal.com/abdullah-logorhythmx/15min";
    if (leadId) await logReply(leadId, fallback, "no_api_key_fallback");
    return json({ reply: fallback });
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
    let guard: string | null = null;
    if (violatesOutputGuard(reply)) {
      guard = "output_guard_tripped";
      reply = "That deserves a straight answer from a person. Book the free intelligence audit and bring the question: https://cal.com/abdullah-logorhythmx/15min";
    }
    if (leadId) await logReply(leadId, reply, guard);
    return json({ reply });
  } catch {
    const fallback = "Thanks for your message. Book a free intelligence audit and we will answer everything live: https://cal.com/abdullah-logorhythmx/15min";
    if (leadId) await logReply(leadId, fallback, "model_error");
    return json({ reply: fallback });
  }
});

async function logReply(leadId: string, reply: string, guard: string | null) {
  const { data: lead } = await sb.from("leads").select("org_id").eq("id", leadId).maybeSingle();
  if (!lead) return;
  await sb.from("communications").insert({
    org_id: lead.org_id, lead_id: leadId, channel: "website", direction: "outbound",
    body: reply, status: "sent", sent_at: new Date().toISOString(),
    meta: { surface: "site-chat", guard },
  });
  await sb.from("audit_logs").insert({
    org_id: lead.org_id, actor_type: "agent", actor: "site-chat",
    action: guard ? "replied_and_flagged" : "replied", subject_type: "lead", subject_id: leadId,
    detail: { guard },
  });
}

async function notifyNewSiteLead(orgId: string, leadId: string, email: string, message: string) {
  const secret = Deno.env.get("ORBIT_WEBHOOK_SECRET");
  const base = Deno.env.get("SUPABASE_URL");
  await fetch(`${base}/functions/v1/notify`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-orbit-secret": secret ?? "" },
    body: JSON.stringify({
      subject: `New site chat lead: ${email}`,
      text: `A visitor shared their email in the Orbit site chat.\n\nEmail: ${email}\nMessage: ${message.slice(0, 300)}\n\nOpen the command center to follow up.`,
    }),
  }).catch(() => {});
  await sb.from("audit_logs").insert({
    org_id: orgId, actor_type: "system", actor: "site-chat",
    action: "lead_email_captured", subject_type: "lead", subject_id: leadId, detail: {},
  });
}

function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

