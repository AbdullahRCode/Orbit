// portal-status: resume progress for a secure portal link. Returns profile, checklist and received docs.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const token = typeof b.token === "string" ? b.token : "";
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: "invalid link" }, 401);

  const { data: lead } = await sb.from("leads")
    .select("id, org_id, full_name, email, service_interest, country, intake_profile, stage")
    .eq("portal_token", token).maybeSingle();
  if (!lead) return json({ error: "invalid link" }, 401);

  const service = lead.service_interest ?? "other";
  const [{ data: reqs }, { data: docs }] = await Promise.all([
    sb.from("document_requirements").select("code, label, description, required, sort")
      .eq("service", service).order("sort"),
    sb.from("documents").select("requirement_code, file_name, size_bytes, uploaded_at")
      .eq("lead_id", lead.id).order("uploaded_at"),
  ]);

  await sb.from("audit_logs").insert({
    org_id: lead.org_id, actor_type: "system", actor: "portal-status",
    action: "portal_viewed", subject_type: "lead", subject_id: lead.id, detail: {},
  });

  return json({
    ok: true,
    lead: { full_name: lead.full_name, service, country: lead.country, profile: lead.intake_profile, stage: lead.stage },
    requirements: reqs ?? [], documents: docs ?? [],
  });
});

function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
