// portal-intake v3: saves the wizard, creates or updates the lead, optionally creates a client
// account, merges profile updates. Notifications now flow through digest-sweep, one email per lead.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SERVICES = ["express_entry","study_permit","work_permit","spousal_sponsorship","visitor_visa","citizenship","other"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  if (typeof b.website === "string" && b.website.trim() !== "") return json({ ok: true });

  const orgSlug = s(b.org_slug) || "orbit-hq";
  const token = s(b.token);
  const service = SERVICES.includes(s(b.service)) ? s(b.service) : "other";
  const fullName = s(b.full_name), email = s(b.email), phone = s(b.phone), country = s(b.country);
  const password = typeof b.password === "string" ? b.password : "";
  const profilePatch = (typeof b.profile === "object" && b.profile !== null) ? b.profile as Record<string, unknown> : {};
  const consent = b.consent === true;

  if (!token && !email) return json({ error: "email required" }, 400);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "invalid email" }, 400);
  if (password && password.length < 8) return json({ error: "password must be at least 8 characters" }, 400);

  const { data: org } = await sb.from("organizations").select("id, settings").eq("slug", orgSlug).single();
  if (!org) return json({ error: "unknown organization" }, 404);

  let lead: { id: string; portal_token: string | null; intake_profile: Record<string, unknown> } | null = null;
  let isNew = false;
  if (token) {
    const { data } = await sb.from("leads").select("id, portal_token, intake_profile")
      .eq("org_id", org.id).eq("portal_token", token).maybeSingle();
    lead = data;
    if (!lead) return json({ error: "invalid link" }, 404);
  } else if (email) {
    const { data } = await sb.from("leads").select("id, portal_token, intake_profile")
      .eq("org_id", org.id).eq("email", email).limit(1).maybeSingle();
    lead = data;
  }

  const mergedProfile = { ...(lead?.intake_profile ?? {}), ...profilePatch };
  const fields: Record<string, unknown> = {
    full_name: fullName || undefined, email: email || undefined, phone: phone || undefined,
    service_interest: service, country: country || undefined,
    intake_profile: mergedProfile,
    stage: "qualifying",
  };
  if (consent) fields.consent = { portal: true, at: new Date().toISOString() };

  if (lead) {
    if (!lead.portal_token) { lead.portal_token = randomToken(); fields.portal_token = lead.portal_token; }
    await sb.from("leads").update(fields).eq("id", lead.id);
  } else {
    isNew = true;
    const newToken = randomToken();
    const { data: created, error } = await sb.from("leads").insert({
      org_id: org.id, source: "website", ...fields, portal_token: newToken,
    }).select("id, portal_token, intake_profile").single();
    if (error) return json({ error: "could not save" }, 500);
    lead = created;
  }

  // optional account creation
  let accountStatus: string | null = null;
  if (password && email) {
    const { data: created, error: authErr } = await sb.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, orbit_role: "client" },
    });
    if (authErr) {
      accountStatus = /already/i.test(authErr.message) ? "exists" : "failed";
    } else if (created?.user) {
      await sb.from("client_accounts").insert({
        auth_user_id: created.user.id, org_id: org.id, lead_id: lead.id,
      });
      accountStatus = "created";
    }
  }

  await sb.from("lead_events").insert({
    org_id: org.id, lead_id: lead.id, type: "portal_intake_saved",
    payload: { service, country, account: accountStatus, is_new: isNew },
  });
  await sb.from("audit_logs").insert({
    org_id: org.id, actor_type: "system", actor: "portal-intake",
    action: isNew ? "lead_captured" : "intake_updated",
    subject_type: "lead", subject_id: lead.id, detail: { service, account: accountStatus },
  });


  const { data: reqs } = await sb.from("document_requirements")
    .select("code, label, description, required, sort").eq("service", service).order("sort");

  return json({ ok: true, token: lead.portal_token, account: accountStatus, requirements: reqs ?? [] });
});

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function s(v: unknown): string { return typeof v === "string" ? v.trim().slice(0, 500) : ""; }
function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
