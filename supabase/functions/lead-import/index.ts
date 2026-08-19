// lead-import: brings a firm's historical lead list into Orbit as the first
// step of the lead leak diagnostic. JWT required, RLS scoped to the calling
// consultant's org. Never touches active case files, this is strictly for
// pre-retainer inquiries the firm already had sitting in a spreadsheet.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ROWS = 5000;
const STATUS_VALUES = new Set(["none", "booked", "completed", "no_show"]);

type Row = {
  full_name?: string; email?: string; phone?: string; service_interest?: string;
  country?: string; last_contact_at?: string; consultation_status?: string;
  quote_sent_at?: string; outcome?: string; notes?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);
  const sbUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const rows = Array.isArray(b.rows) ? (b.rows as Row[]).slice(0, MAX_ROWS) : [];
  if (rows.length === 0) return json({ error: "no rows provided" }, 400);

  const { data: userRow, error: userErr } = await sbUser.from("users").select("org_id").limit(1).maybeSingle();
  if (userErr || !userRow) return json({ error: "not permitted" }, 403);
  const orgId = userRow.org_id;

  const batch = typeof b.batch_label === "string" && b.batch_label.trim()
    ? b.batch_label.trim().slice(0, 80)
    : `import-${new Date().toISOString().slice(0, 10)}`;

  let created = 0, skipped = 0;
  const toInsert: Record<string, unknown>[] = [];

  for (const r of rows) {
    const email = str(r.email);
    const fullName = str(r.full_name);
    if (!email && !fullName) { skipped++; continue; }

    const status = STATUS_VALUES.has(str(r.consultation_status).toLowerCase())
      ? str(r.consultation_status).toLowerCase() : "none";
    const lastContact = parseDate(r.last_contact_at);
    const quoteSent = parseDate(r.quote_sent_at);

    toInsert.push({
      org_id: orgId, source: "other", stage: inferStage(status, r.outcome),
      full_name: fullName || null, email: email || null, phone: str(r.phone) || null,
      service_interest: str(r.service_interest) || null, country: str(r.country) || null,
      consultation_status: status, last_contact_at: lastContact, quote_sent_at: quoteSent,
      outcome: str(r.outcome) || null, notes: str(r.notes) || null, import_batch: batch,
      intake_profile: { import_raw: r },
    });
  }

  if (toInsert.length === 0) return json({ ok: true, created: 0, skipped, batch });

  const { data: inserted, error: insErr } = await sbUser.from("leads").insert(toInsert).select("id");
  if (insErr) return json({ error: "import failed", detail: insErr.message }, 500);
  created = inserted?.length ?? 0;

  if (inserted) {
    await sbUser.from("lead_events").insert(
      inserted.map((l) => ({ org_id: orgId, lead_id: l.id, type: "imported", payload: { batch } })),
    );
  }
  await sbUser.from("audit_logs").insert({
    org_id: orgId, actor_type: "user", actor: "consultant", action: "lead_import",
    subject_type: "lead_batch", detail: { batch, created, skipped, submitted: rows.length },
  });

  return json({ ok: true, created, skipped, batch });
});

function inferStage(status: string, outcome: unknown): string {
  const o = str(outcome).toLowerCase();
  if (o.includes("retain") || o.includes("client")) return "retained";
  if (o.includes("lost") || o.includes("declined") || o.includes("not interested")) return "lost";
  if (status === "completed") return "consulted";
  if (status === "booked") return "booked";
  return "new";
}
function parseDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function str(v: unknown): string { return typeof v === "string" ? v.trim().slice(0, 500) : ""; }
function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
