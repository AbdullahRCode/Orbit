// daily-briefing: compiles the last 24 hours into a morning briefing per organization.
// Uses real counts only. Narrative is generated only from those counts, never invented.
// Auth: x-orbit-secret header must match ORBIT_WEBHOOK_SECRET when that secret is set.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("ORBIT_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-orbit-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const orgSlug = typeof body.org_slug === "string" ? body.org_slug : "orbit-hq";

  const { data: org } = await sb.from("organizations").select("id, name, timezone").eq("slug", orgSlug).single();
  if (!org) return json({ error: "unknown organization" }, 404);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [newLeads, qualified, booked, humanNeeded, pendingApprovals, inboundMsgs] = await Promise.all([
    count("leads", (q) => q.eq("org_id", org.id).gte("created_at", since)),
    count("leads", (q) => q.eq("org_id", org.id).eq("stage", "qualified")),
    count("appointments", (q) => q.eq("org_id", org.id).eq("status", "scheduled")),
    count("leads", (q) => q.eq("org_id", org.id).eq("human_needed", true)),
    count("approvals", (q) => q.eq("org_id", org.id).eq("status", "pending")),
    count("communications", (q) => q.eq("org_id", org.id).eq("direction", "inbound").gte("created_at", since)),
  ]);

  const stats = {
    new_leads_24h: newLeads, qualified_open: qualified, consultations_scheduled: booked,
    waiting_on_a_human: humanNeeded, pending_approvals: pendingApprovals, inbound_messages_24h: inboundMsgs,
  };

  const structured = [
    `Daily briefing for ${org.name}`,
    ``,
    `Leads: ${newLeads} new in the last 24 hours. ${qualified} qualified and open.`,
    `Consultations: ${booked} scheduled.`,
    `Needs you: ${humanNeeded} conversation${humanNeeded === 1 ? "" : "s"} waiting on a human, ${pendingApprovals} item${pendingApprovals === 1 ? "" : "s"} pending approval.`,
    `Activity: ${inboundMsgs} inbound message${inboundMsgs === 1 ? "" : "s"} in the last 24 hours.`,
  ].join("\n");

  let narrative = structured;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 350,
          system: "You write a short morning briefing for the owner of an immigration consulting practice. Use only the numbers provided, never invent data. Plain, direct, sentence case, no em dashes, under 120 words. Lead with what needs attention.",
          messages: [{ role: "user", content: `Write the briefing from these stats as JSON: ${JSON.stringify(stats)}` }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = (data.content?.[0]?.text ?? "").trim();
        if (text) narrative = text;
      }
    } catch { /* keep the structured fallback */ }
  }

  const today = new Date().toISOString().slice(0, 10);
  await sb.from("briefings").upsert(
    { org_id: org.id, briefing_date: today, body: narrative, stats },
    { onConflict: "org_id,briefing_date" },
  );

  await sb.from("audit_logs").insert({
    org_id: org.id, actor_type: "agent", actor: "daily-briefing",
    action: "briefing_generated", detail: stats,
  });

  return json({ ok: true, briefing_date: today, stats, body: narrative });
});

async function count(table: string, build: (q: any) => any): Promise<number> {
  const q = build(sb.from(table).select("id", { count: "exact", head: true }));
  const { count: c } = await q;
  return c ?? 0;
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
