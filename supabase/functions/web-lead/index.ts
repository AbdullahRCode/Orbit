// web-lead: public website form and chat entry point. Honeypot protected, CORS enabled.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  // honeypot: real users never fill this field
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json({ ok: true });
  }

  const orgSlug = str(body.org_slug) || "orbit-hq";
  const fullName = str(body.full_name);
  const email = str(body.email);
  const phone = str(body.phone);
  const service = str(body.service_interest);
  const message = str(body.message);

  if (!email && !phone) return json({ error: "email or phone required" }, 400);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "invalid email" }, 400);

  const { data: org } = await sb.from("organizations").select("id").eq("slug", orgSlug).single();
  if (!org) return json({ error: "unknown organization" }, 404);

  // reuse an existing lead with the same email for this org, otherwise create
  let leadId: string | null = null;
  if (email) {
    const { data: existing } = await sb.from("leads").select("id")
      .eq("org_id", org.id).eq("email", email).limit(1).maybeSingle();
    if (existing) leadId = existing.id;
  }

  if (leadId) {
    await sb.from("leads").update({
      full_name: fullName || undefined,
      phone: phone || undefined,
      service_interest: service || undefined,
    }).eq("id", leadId);
  } else {
    const { data: created, error } = await sb.from("leads").insert({
      org_id: org.id, source: "website", full_name: fullName, email, phone,
      service_interest: service, stage: "new",
    }).select("id").single();
    if (error) return json({ error: "could not save" }, 500);
    leadId = created.id;
  }

  await sb.from("lead_events").insert({
    org_id: org.id, lead_id: leadId, type: "web_form_submitted",
    payload: { service, has_message: !!message },
  });
  if (message) {
    await sb.from("communications").insert({
      org_id: org.id, lead_id: leadId, channel: "website",
      direction: "inbound", body: message.slice(0, 4000), status: "received",
    });
  }
  await sb.from("audit_logs").insert({
    org_id: org.id, actor_type: "system", actor: "web-lead",
    action: "lead_captured", subject_type: "lead", subject_id: leadId,
    detail: { source: "website" },
  });

  return json({ ok: true, lead_id: leadId });
});

function str(v: unknown): string { return typeof v === "string" ? v.trim().slice(0, 500) : ""; }
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
