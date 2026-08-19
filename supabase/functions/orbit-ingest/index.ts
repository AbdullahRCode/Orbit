// orbit-ingest: buffers inbound messages from any channel (ManyChat, WhatsApp bridge, email relay).
// Auth: x-orbit-secret header must match ORBIT_WEBHOOK_SECRET when that secret is set.
import { createClient } from "npm:@supabase/supabase-js@2";
import { withinRateLimit } from "../_shared/rate-limit.ts";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SOURCES: Record<string, string> = {
  instagram: "instagram", website: "website", whatsapp: "whatsapp", email: "email",
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const secret = Deno.env.get("ORBIT_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-orbit-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const orgSlug = str(body.org_slug) || "orbit-hq";
  const channel = SOURCES[str(body.channel)] ? str(body.channel) : "other";
  const externalId = str(body.external_user_id);
  const name = str(body.name);
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";

  if (!externalId || !text) return json({ error: "external_user_id and text required" }, 400);

  // Defense in depth even though this endpoint is secret-gated: caps how
  // fast one external sender (or a compromised secret) can generate load.
  const ok = await withinRateLimit(sb, "orbit-ingest", `${orgSlug}:${externalId}`, 40, 600);
  if (!ok) return json({ error: "rate limited" }, 429);

  const { data: org } = await sb.from("organizations").select("id").eq("slug", orgSlug).single();
  if (!org) return json({ error: "unknown organization" }, 404);

  const source = SOURCES[channel] ?? "other";
  let { data: lead } = await sb.from("leads").select("id, stage")
    .eq("org_id", org.id).eq("source", source).eq("external_id", externalId).maybeSingle();

  if (!lead) {
    const { data: created, error } = await sb.from("leads").insert({
      org_id: org.id, source, external_id: externalId, full_name: name || null, stage: "new",
    }).select("id, stage").single();
    if (error) return json({ error: "could not create lead" }, 500);
    lead = created;
    await sb.from("lead_events").insert({
      org_id: org.id, lead_id: lead.id, type: "lead_created", payload: { channel },
    });
  }

  const { data: comm, error: commErr } = await sb.from("communications").insert({
    org_id: org.id, lead_id: lead.id, channel: source === "other" ? "other" : source,
    direction: "inbound", body: text, status: "received",
  }).select("id").single();
  if (commErr) return json({ error: "could not buffer message" }, 500);

  await sb.from("audit_logs").insert({
    org_id: org.id, actor_type: "system", actor: "orbit-ingest",
    action: "message_buffered", subject_type: "communication", subject_id: comm.id,
    detail: { channel, external_user_id: externalId },
  });

  return json({ ok: true, lead_id: lead.id, communication_id: comm.id });
});

function str(v: unknown): string { return typeof v === "string" ? v.trim().slice(0, 500) : ""; }
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
