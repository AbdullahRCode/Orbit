// portal-chat v3: the Orbit guide, now knowledge powered. Pulls the verified applicant canon
// from knowledge_items at runtime, answers general questions with official sources, never
// quotes figures that change annually, and escalates everything advice shaped. Daily cap kept.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-sonnet-4-6";
const DAILY_CAP = 20;

const FORBIDDEN_OUTPUT = [
  /you (are|'re)\s+(likely\s+|probably\s+)?(eligible|qualified)/i,
  /you\s+qualify/i,
  /your\s+(best|ideal)\s+(option|pathway|program)\s+is/i,
  /i\s+recommend\s+(applying|the)\s/i,
  /guarantee/i,
  /\b\d{2,3}\s?%\s+(success|approval|chance)/i,
  /(approved|endorsed|affiliated)\s+(by|with)\s+(the\s+)?(government|ircc)/i,
];
const ESCALATE_INPUT = [
  /refus(ed|al)/i, /appeal/i, /misrepresent/i, /deport/i, /removal\s+order/i,
  /scam|fraud/i, /complain/i, /urgent|emergency/i,
  /am\s+i\s+eligible/i, /do\s+i\s+qualify/i, /my\s+chances/i, /chances\s+of\s+(approval|getting)/i,
  /which\s+(program|province|pathway|option|stream)\s+(is\s+)?(best|better|right)/i,
  /should\s+i\s+(apply|choose|pick|wait|reapply)/i,
  /will\s+(i|my|it)\s+(get|be)\s+(approved|accepted|refused|rejected)/i,
  /ghost\s+consultant/i,
];

async function loadKnowledge(orgId: string): Promise<string> {
  const { data } = await sb.from("knowledge_items")
    .select("title, content, source_url")
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .eq("category", "official_source")
    .order("created_at").limit(80);
  if (!data || data.length === 0) return "";
  return "\nVerified general knowledge. When a question matches, answer from here and mention the official source in plain words:\n" +
    data.map((k) => `Q: ${k.title}. A: ${k.content}${k.source_url ? " Source: " + k.source_url : ""}`).join("\n");
}

function guidePrompt(orgName: string, service: string, checklist: string, knowledge: string): string {
  return [
    `You are Orbit, the portal guide for ${orgName}, a Canadian immigration consulting practice. You are a warm, patient, 24/7 admin assistant inside the client's secure document portal. You are not a salesperson and not a consultant.`,
    "",
    "Your job: help the person use the portal, explain in general public terms what each requested document is and where people usually obtain it, explain what happens after uploads and after booking, reassure with care, and adapt to the person's language and emotional state.",
    "",
    "Language: reply fluently in whatever language the person writes in, do not default back to English. Canadian immigration applicants very commonly write in Hindi, Punjabi, Mandarin, Cantonese, Tagalog, Spanish, Vietnamese, Korean, Arabic, French and Portuguese, treat fluent, natural reply in each of these as a baseline expectation, not a stretch case. Match their script too, for example Devanagari for Hindi or Gurmukhi for Punjabi, if that is what they used. Every wall below holds in every language equally, translation is never a loophole.",
    "",
    `Their chosen service: ${service}. Their checklist: ${checklist}.`,
    "",
    "Absolute walls, never break them in any language:",
    "1. Never assess eligibility, never recommend a pathway, never predict outcomes, never say you qualify. Only a licensed professional may advise under Canadian law.",
    "2. Never guarantee results, never imply a government relationship.",
    "3. General public information only, pointing to official sources like canada.ca in plain words.",
    "4. Questions about their specific case, chances, refusals, or strategy: say warmly that the consultant will cover exactly that in the consultation.",
    "5. If they seem distressed or mention fraud or a complaint: acknowledge kindly, do not argue, say a person will follow up.",
    "6. If asked, say plainly you are a digital assistant named Orbit and a human reviews everything important.",
    "",
    "Working rules:",
    "- Never state dollar amounts, fee figures or thresholds that change over time. Point to the official page for the current figure instead.",
    "- People often say visa for everything, PR for permanent residence, file or case for application, agent for representative, points for CRS. Understand these and gently use the official term.",
    "- When someone is anxious: first validate the feeling in one short phrase, then give the general fact with its official source, then hand the personal part to the consultant.",
    "- If someone fears scams or mentions paying someone for a job or outcome: no one can guarantee an immigration outcome, IRCC never demands cash or crypto, and licensed consultants can be verified on the CICC public register at register.college-ic.ca.",
    knowledge,
    "",
    "Style: 40 words or fewer. Sentence case. No em dashes. One helpful thing per reply, then a gentle next step.",
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const token = typeof b.token === "string" ? b.token : "";
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 1500) : "";
  if (!/^[0-9a-f]{64}$/.test(token) || !message) return json({ error: "invalid request" }, 400);

  const { data: lead } = await sb.from("leads")
    .select("id, org_id, full_name, service_interest, human_needed")
    .eq("portal_token", token).maybeSingle();
  if (!lead) return json({ error: "invalid link" }, 401);

  const { data: org } = await sb.from("organizations").select("name, settings").eq("id", lead.org_id).single();
  const settings = (org?.settings ?? {}) as Record<string, string>;
  const bookingUrl = settings.booking_url || "https://cal.com/abdullah-logorhythmx/15min";

  // daily cap: count today's inbound guide messages before accepting this one
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const { count: usedToday } = await sb.from("communications")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", lead.id).eq("channel", "website").eq("direction", "inbound")
    .gte("created_at", dayStart.toISOString());
  if ((usedToday ?? 0) >= DAILY_CAP) {
    return json({ reply: `You have reached today's limit for the guide. Your consultant will pick things up from here, or you can book a time directly: ${bookingUrl}` });
  }

  await sb.from("communications").insert({
    org_id: lead.org_id, lead_id: lead.id, channel: "website",
    direction: "inbound", body: message, status: "received", claimed_at: new Date().toISOString(),
  });

  let humanNeeded = lead.human_needed;
  let guardNote: string | null = null;
  if (ESCALATE_INPUT.some((r) => r.test(message))) { humanNeeded = true; guardNote = "input_escalation"; }

  const [{ data: reqs }, knowledge] = await Promise.all([
    sb.from("document_requirements").select("label").eq("service", lead.service_interest ?? "other").order("sort"),
    loadKnowledge(lead.org_id),
  ]);
  const checklist = (reqs ?? []).map((r) => r.label).join(", ") || "general documents";

  const { data: history } = await sb.from("communications")
    .select("direction, body").eq("lead_id", lead.id).eq("channel", "website")
    .order("created_at", { ascending: true }).limit(12);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  let reply: string;

  if (!apiKey) {
    reply = `Thanks for your message. A member of the team will reply personally soon. You can also book a consultation here: ${bookingUrl}`;
    humanNeeded = true;
  } else {
    try {
      const msgs = (history ?? []).map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant", content: m.body,
      }));
      const collapsed: { role: string; content: string }[] = [];
      for (const m of msgs) {
        const last = collapsed[collapsed.length - 1];
        if (last && last.role === m.role) last.content += "\n" + m.content;
        else collapsed.push({ ...m });
      }
      if (collapsed.length === 0 || collapsed[0].role !== "user") collapsed.unshift({ role: "user", content: message });

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: MODEL, max_tokens: 200,
          system: guidePrompt(org?.name ?? "the practice", (lead.service_interest ?? "other").replace(/_/g, " "), checklist, knowledge),
          messages: collapsed,
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const data = await res.json();
      reply = (data.content?.[0]?.text ?? "").trim() || "I am here to help with the portal. What would you like to know?";
      if (FORBIDDEN_OUTPUT.some((r) => r.test(reply))) {
        guardNote = "output_guard_tripped"; humanNeeded = true;
        reply = `That is exactly what your consultant will answer for you personally in the consultation. You can book here anytime: ${bookingUrl}`;
      }
    } catch {
      humanNeeded = true;
      reply = `Thanks for your message. A member of the team will reply personally soon. You can also book a consultation here: ${bookingUrl}`;
    }
  }

  await sb.from("communications").insert({
    org_id: lead.org_id, lead_id: lead.id, channel: "website",
    direction: "outbound", body: reply, status: "sent", sent_at: new Date().toISOString(),
    meta: { model: apiKey ? MODEL : "fallback", guard: guardNote, surface: "portal-chat" },
  });
  if (humanNeeded !== lead.human_needed) {
    await sb.from("leads").update({ human_needed: humanNeeded }).eq("id", lead.id);
  }
  await sb.from("audit_logs").insert({
    org_id: lead.org_id, actor_type: "agent", actor: "portal-chat",
    action: humanNeeded ? "replied_and_escalated" : "replied",
    subject_type: "lead", subject_id: lead.id, detail: { guard: guardNote },
  });

  return json({ reply });
});

function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
