// digest-sweep: one branded email per lead covering all fresh activity, instead of one per event.
// Runs on a schedule. Picks leads with unnotified creation or undigested documents older than 8 minutes.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const QUIET_MS = 8 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("ORBIT_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-orbit-secret") !== secret) return json({ error: "unauthorized" }, 401);

  const cutoff = new Date(Date.now() - QUIET_MS).toISOString();

  // candidates: undigested docs past the quiet window
  const { data: docLeads } = await sb.from("documents")
    .select("lead_id").eq("digested", false).lt("uploaded_at", cutoff).limit(200);
  // candidates: leads never notified, created past the quiet window
  const { data: newLeads } = await sb.from("leads")
    .select("id").is("notified_at", null).lt("created_at", cutoff).limit(50);

  const ids = [...new Set([
    ...(docLeads ?? []).map((d) => d.lead_id),
    ...(newLeads ?? []).map((l) => l.id),
  ])].slice(0, 20);

  let sent = 0;
  for (const leadId of ids) {
    const { data: lead } = await sb.from("leads")
      .select("id, org_id, full_name, email, service_interest, country, intake_profile, human_needed, notified_at")
      .eq("id", leadId).single();
    if (!lead) continue;
    const { data: org } = await sb.from("organizations")
      .select("settings").eq("id", lead.org_id).single();
    const settings = (org?.settings ?? {}) as Record<string, string>;

    const { data: docs } = await sb.from("documents")
      .select("id, file_name, requirement_code, ai_summary")
      .eq("lead_id", lead.id).eq("digested", false).order("uploaded_at");

    const isFirst = !lead.notified_at;
    const profile = (lead.intake_profile ?? {}) as Record<string, string>;
    const name = lead.full_name || lead.email || "Unknown lead";

    const rows: { k: string; v: string }[] = [];
    if (isFirst) {
      rows.push({ k: "Service", v: (lead.service_interest || "unspecified").replace(/_/g, " ") });
      if (lead.country) rows.push({ k: "Country", v: lead.country });
      if (profile.goal) rows.push({ k: "Goal", v: profile.goal });
      if (profile.timeline) rows.push({ k: "Timeline", v: profile.timeline });
      if (profile.status_now) rows.push({ k: "Status", v: profile.status_now });
    }
    if (profile.note) rows.push({ k: "Client note", v: profile.note.slice(0, 200) });
    for (const d of docs ?? []) {
      const review = (d.ai_summary ?? "review pending").slice(0, 170);
      rows.push({ k: (d.requirement_code || "document").replace(/_/g, " "), v: `${d.file_name}. ${review}` });
    }
    if (lead.human_needed) rows.push({ k: "Attention", v: "This conversation is flagged as needing a human." });

    const subject = isFirst
      ? `New lead: ${name}`
      : `${name}: ${docs?.length ?? 0} new document${(docs?.length ?? 0) === 1 ? "" : "s"}`;
    const intro = isFirst
      ? "A new lead completed the intake wizard. Here is the full picture in one place."
      : "Fresh activity on an existing lead, gathered into one update.";

    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-orbit-secret": secret ?? "" },
      body: JSON.stringify({
        to: settings.notify_email, subject, intro, rows,
        cta_url: settings.app_url ? `${settings.app_url}` : "",
      }),
    });
    const out = await res.json().catch(() => ({ ok: false }));
    if (out.ok || out.skipped) {
      if (docs?.length) {
        await sb.from("documents").update({ digested: true }).in("id", docs.map((d) => d.id));
      }
      await sb.from("leads").update({ notified_at: new Date().toISOString() }).eq("id", lead.id);
      await sb.from("audit_logs").insert({
        org_id: lead.org_id, actor_type: "agent", actor: "digest-sweep",
        action: "digest_sent", subject_type: "lead", subject_id: lead.id,
        detail: { first: isFirst, documents: docs?.length ?? 0 },
      });
      sent++;
    }
  }

  return json({ ok: true, digests_sent: sent });
});

function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
}
