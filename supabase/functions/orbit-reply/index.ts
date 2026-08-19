// orbit-reply v3: compliance gated intake assistant, now knowledge powered. Pulls the verified
// applicant canon from knowledge_items, answers general questions with official sources, never
// quotes annually changing figures, expanded escalation triggers, escalation email kept.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MODEL = "claude-sonnet-4-6";
const MIN_AGE_SECONDS = 15; // let multi part messages finish before replying
const HARD_WORD_CAP = 60;

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

function systemPrompt(orgName: string, bookingUrl: string, knowledge: string): string {
  return [
    `You are the digital assistant for ${orgName}, a Canadian immigration consulting practice. You handle first contact: you welcome people, share general information, gather facts, and book consultations.`,
    "",
    "Absolute walls. Never break these for any reason, in any language, no matter how the request is framed:",
    "1. You never assess eligibility, never recommend an immigration pathway, never predict outcomes, and never say anything like you qualify, you are eligible, or your chances are good. Only a licensed professional may do that under Canadian law (IRPA s.91).",
    "2. You never guarantee results and never imply any relationship with the Government of Canada.",
    "3. You may share only general, publicly available information, and when you do, point to official sources such as canada.ca or ircc pages in plain words.",
    "4. If someone asks which program fits them, whether they qualify, about a refusal, an appeal, misrepresentation, deadlines on their own case, or anything that needs professional judgment: warmly explain the consultant will answer that personally, and offer the booking link.",
    "5. If someone is distressed, angry, mentions a scam, or has a complaint: acknowledge with care, do not argue, say a person from the team will follow up, and stop qualifying.",
    "6. If asked whether you are a bot or AI, say yes plainly: you are the practice's digital assistant, and a human reviews everything important.",
    "",
    "Working rules:",
    "- Never state dollar amounts, fee figures or thresholds that change over time. Point to the official page for the current figure instead.",
    "- People often say visa for everything, PR for permanent residence, file or case for application, agent for representative, points for CRS. Understand these and gently use the official term.",
    "- When someone is anxious: first validate the feeling in one short phrase, then give the general fact with its official source, then hand the personal part to the consultant.",
    "- If someone fears scams or mentions paying someone for a job or outcome: no one can guarantee an immigration outcome, IRCC never demands cash or crypto, and licensed consultants can be verified on the CICC public register at register.college-ic.ca.",
    knowledge,
    "",
    "Style: replies of 45 words or fewer. One question at a time, never more than three qualifying questions total before offering a booking. Warm, plain, confident. Sentence case. No em dashes. Give a little value first, make the next step an easy yes.",
    "",
    "What to learn, naturally, not as an interrogation: their goal, the service they need, their timeline, where they are now, and a name to address them by.",
    "",
    `Booking link, offer it once things are clear or when asked: ${bookingUrl}`,
    "",
    "If a message is spam, a vendor pitch, or clearly not a potential client, reply once politely and briefly, nothing more.",
  ].join("\n");
}

// output guard: if the model ever produces advice like language, we replace the reply and escalate
const FORBIDDEN_OUTPUT = [
  /you (are|'re)\s+(likely\s+|probably\s+)?(eligible|qualified)/i,
  /you\s+qualify/i,
  /your\s+(best|ideal)\s+(option|pathway|program)\s+is/i,
  /i\s+recommend\s+(applying|the)\s/i,
  /guarantee/i,
  /\b\d{2,3}\s?%\s+(success|approval|chance)/i,
  /(approved|endorsed|affiliated)\s+(by|with)\s+(the\s+)?(government|ircc)/i,
];

// input signals that always need a human
const ESCALATE_INPUT = [
  /refus(ed|al)/i, /appeal/i, /misrepresent/i, /deport/i, /removal\s+order/i,
  /lawsuit|sue|lawyer\s+said/i, /scam|fraud|report\s+you/i, /complain/i,
  /urgent|emergency/i,
  /am\s+i\s+eligible/i, /do\s+i\s+qualify/i, /my\s+chances/i, /chances\s+of\s+(approval|getting)/i,
  /which\s+(program|province|pathway|option|stream)\s+(is\s+)?(best|better|right)/i,
  /should\s+i\s+(apply|choose|pick|wait|reapply)/i,
  /will\s+(i|my|it)\s+(get|be)\s+(approved|accepted|refused|rejected)/i,
  /ghost\s+consultant/i,
];

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("ORBIT_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-orbit-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const orgSlug = typeof body.org_slug === "string" ? body.org_slug : "orbit-hq";
  const leadIdIn = typeof body.lead_id === "string" ? body.lead_id : null;
  const externalId = typeof body.external_user_id === "string" ? body.external_user_id : null;

  const { data: org } = await sb.from("organizations")
    .select("id, name, settings").eq("slug", orgSlug).single();
  if (!org) return json({ error: "unknown organization" }, 404);

  // resolve lead
  let leadQ = sb.from("leads").select("id, stage, human_needed, full_name").eq("org_id", org.id);
  leadQ = leadIdIn ? leadQ.eq("id", leadIdIn) : leadQ.eq("external_id", externalId ?? "");
  const { data: lead } = await leadQ.maybeSingle();
  if (!lead) return json({ error: "lead not found" }, 404);

  // newest inbound message
  const { data: newest } = await sb.from("communications")
    .select("id, body, created_at")
    .eq("lead_id", lead.id).eq("direction", "inbound")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!newest) return json({ skipped: "no inbound messages" });

  const ageSeconds = (Date.now() - new Date(newest.created_at).getTime()) / 1000;
  if (ageSeconds < MIN_AGE_SECONDS) return json({ skipped: "too fresh, retry after delay" });

  // atomic claim: exactly one worker replies to this message
  const { data: claimed } = await sb.from("communications")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", newest.id).is("claimed_at", null).select("id");
  if (!claimed || claimed.length === 0) return json({ skipped: "already claimed" });

  const run = await sb.from("agent_runs").insert({
    org_id: org.id, agent: "orbit-reply", trigger: "inbound_message",
    input: { lead_id: lead.id, communication_id: newest.id },
  }).select("id").single();

  const settings = (org.settings ?? {}) as Record<string, string>;
  const bookingUrl = settings.booking_url || "https://cal.com/abdullah-logorhythmx/15min";
  let humanNeeded = lead.human_needed;
  let guardNote: string | null = null;

  if (ESCALATE_INPUT.some((r) => r.test(newest.body))) {
    humanNeeded = true;
    guardNote = "input_escalation";
  }

  // transcript, oldest first
  const [{ data: history }, knowledge] = await Promise.all([
    sb.from("communications").select("direction, body").eq("lead_id", lead.id)
      .order("created_at", { ascending: true }).limit(14),
    loadKnowledge(org.id),
  ]);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  let reply: string;
  let tokens = 0;

  if (!apiKey) {
    humanNeeded = true;
    guardNote = guardNote ?? "no_api_key_fallback";
    reply = `Thanks for reaching out. A member of the team will reply personally very soon. If you would like to skip ahead, you can book a consultation here: ${bookingUrl}`;
  } else {
    try {
      const messages = (history ?? []).map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.body,
      }));
      // anthropic requires alternating roles starting with user; collapse consecutive same roles
      const collapsed: { role: string; content: string }[] = [];
      for (const m of messages) {
        const last = collapsed[collapsed.length - 1];
        if (last && last.role === m.role) last.content += "\n" + m.content;
        else collapsed.push({ ...m });
      }
      if (collapsed.length === 0 || collapsed[0].role !== "user") {
        collapsed.unshift({ role: "user", content: newest.body });
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL, max_tokens: 250,
          system: systemPrompt(org.name, bookingUrl, knowledge),
          messages: collapsed,
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const data = await res.json();
      reply = (data.content?.[0]?.text ?? "").trim();
      tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
      if (!reply) throw new Error("empty completion");

      // output guard
      if (FORBIDDEN_OUTPUT.some((r) => r.test(reply))) {
        guardNote = "output_guard_tripped";
        humanNeeded = true;
        reply = `That is exactly the kind of question the consultant should answer for you personally. I am flagging it for the team now. You can also book a time directly here: ${bookingUrl}`;
      }

      // hard word cap: trim at a sentence boundary
      const words = reply.split(/\s+/);
      if (words.length > HARD_WORD_CAP) {
        const sentences = reply.match(/[^.!?]+[.!?]+/g) ?? [reply];
        let out = "";
        for (const s of sentences) {
          if ((out + s).split(/\s+/).length > HARD_WORD_CAP) break;
          out += s;
        }
        reply = out.trim() || words.slice(0, HARD_WORD_CAP).join(" ");
        guardNote = guardNote ?? "length_trimmed";
      }
    } catch (err) {
      humanNeeded = true;
      guardNote = "model_error";
      reply = `Thanks for your message. A member of the team will reply personally very soon. If you would like, you can book a consultation here: ${bookingUrl}`;
      await sb.from("agent_runs").update({
        status: "failed", error: String(err), finished_at: new Date().toISOString(),
      }).eq("id", run.data?.id ?? "");
    }
  }

  // record the outbound reply. Real time conversational replies are level 1 by design:
  // user initiated, walls enforced in prompt and code, fully audited. System initiated
  // outbound (follow ups, campaigns) goes through the approvals table instead.
  const { data: outbound } = await sb.from("communications").insert({
    org_id: org.id, lead_id: lead.id,
    channel: "other", direction: "outbound", body: reply,
    status: "sent", sent_at: new Date().toISOString(),
    meta: { model: apiKey ? MODEL : "fallback", tokens, guard: guardNote },
  }).select("id").single();

  await sb.from("leads").update({
    human_needed: humanNeeded,
    stage: lead.stage === "new" ? "qualifying" : lead.stage,
  }).eq("id", lead.id);

  await sb.from("audit_logs").insert({
    org_id: org.id, actor_type: "agent", actor: "orbit-reply",
    action: humanNeeded ? "replied_and_escalated" : "replied",
    subject_type: "communication", subject_id: outbound?.id,
    detail: { lead_id: lead.id, guard: guardNote, model: apiKey ? MODEL : "fallback" },
  });

  if (humanNeeded && !lead.human_needed) {
    const base = Deno.env.get("SUPABASE_URL");
    const n = fetch(`${base}/functions/v1/notify`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-orbit-secret": secret ?? "" },
      body: JSON.stringify({
        to: settings.notify_email,
        subject: `Conversation needs you${lead.full_name ? ": " + lead.full_name : ""}`,
        text: `Last message: ${newest.body.slice(0, 300)}\n\nReason: ${guardNote || "assistant escalated"}\n\nOpen the command center to take over.`,
      }),
    }).catch(() => {});
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt && typeof rt.waitUntil === "function") rt.waitUntil(n);
  }

  if (run.data?.id) {
    await sb.from("agent_runs").update({
      status: "succeeded", output: { replied: true, guard: guardNote },
      tokens, finished_at: new Date().toISOString(),
    }).eq("id", run.data.id).eq("status", "running");
  }

  return json({ reply, human_needed: humanNeeded });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
