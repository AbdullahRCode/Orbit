// lead-leak-report: the actual diagnostic product. Scores a firm's lead
// history against observable business events, no guessing, no advice, just
// what the record shows: who was never followed up with, who consulted but
// never retained, who went cold, and who is worth a second look. JWT
// required, RLS scoped. Produces JSON for the UI and a PDF for the pitch.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sbAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const DORMANT_DAYS = 90;
const TOP_N = 25;

type LeadRow = {
  id: string; full_name: string | null; email: string | null; service_interest: string | null;
  stage: string; consultation_status: string; last_contact_at: string | null;
  quote_sent_at: string | null; outcome: string | null; created_at: string; import_batch: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);
  const sbUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { b = {}; }
  const batch = typeof b.batch === "string" ? b.batch : null;

  const { data: userRow } = await sbUser.from("users").select("org_id").limit(1).maybeSingle();
  if (!userRow) return json({ error: "not permitted" }, 403);

  const { data: org } = await sbUser.from("organizations").select("id, name").eq("id", userRow.org_id).maybeSingle();

  let q = sbUser.from("leads")
    .select("id, full_name, email, service_interest, stage, consultation_status, last_contact_at, quote_sent_at, outcome, created_at, import_batch");
  if (batch) q = q.eq("import_batch", batch);
  const { data: leads, error } = await q;
  if (error) return json({ error: "could not load leads" }, 500);
  if (!leads || leads.length === 0) return json({ error: "no leads found for this scope" }, 404);

  const now = Date.now();
  const dormantMs = DORMANT_DAYS * 24 * 60 * 60 * 1000;
  const active = (l: LeadRow) => l.stage !== "retained" && l.stage !== "lost" && l.stage !== "not_a_lead";
  const daysDormant = (l: LeadRow) => {
    const anchor = l.last_contact_at ?? l.created_at;
    return Math.floor((now - new Date(anchor).getTime()) / (24 * 60 * 60 * 1000));
  };

  const neverFollowedUp = leads.filter((l) => !l.last_contact_at && l.consultation_status === "none" && l.stage === "new");
  const consultedNeverRetained = leads.filter((l) => l.consultation_status === "completed" && l.stage !== "retained");
  const wentCold = leads.filter((l) => l.last_contact_at && active(l) && (now - new Date(l.last_contact_at).getTime()) > dormantMs);
  const retained = leads.filter((l) => l.stage === "retained");

  // Reengageable: went cold or consulted-never-retained, still active, ranked
  // by strongest signal first (a completed consultation beats a cold inquiry
  // that never progressed), then by recency within that tier.
  const reengageablePool = leads.filter((l) =>
    active(l) && (wentCold.includes(l) || consultedNeverRetained.includes(l)));
  const reengageable = [...reengageablePool].sort((a, b2) => {
    const aScore = a.consultation_status === "completed" ? 1 : 0;
    const bScore = b2.consultation_status === "completed" ? 1 : 0;
    if (aScore !== bScore) return bScore - aScore;
    return daysDormant(a) - daysDormant(b2);
  }).slice(0, TOP_N);

  const stats = {
    total_analyzed: leads.length,
    never_followed_up: neverFollowedUp.length,
    consulted_never_retained: consultedNeverRetained.length,
    went_cold: wentCold.length,
    retained: retained.length,
    reengageable_count: reengageablePool.length,
  };

  const pdfBytes = await buildReportPdf(org?.name ?? "Your practice", stats, reengageable.map((l) => ({
    name: l.full_name || l.email || "Unnamed lead",
    service: l.service_interest, days_dormant: daysDormant(l),
    consulted: l.consultation_status === "completed",
  })));

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${userRow.org_id}/lead-leak-report-${stamp}.pdf`;
  await sbAdmin.storage.from("exports").upload(path, pdfBytes, { contentType: "application/pdf", upsert: false });
  const { data: signed } = await sbAdmin.storage.from("exports").createSignedUrl(path, 60 * 60 * 24);

  await sbUser.from("audit_logs").insert({
    org_id: userRow.org_id, actor_type: "user", actor: "consultant", action: "lead_leak_report",
    detail: { batch, ...stats },
  });

  return json({
    ok: true, ...stats,
    reengageable_sample: reengageable.slice(0, 10).map((l) => ({
      name: l.full_name || l.email, service: l.service_interest, days_dormant: daysDormant(l),
    })),
    report_url: signed?.signedUrl ?? null, expires_in_hours: 24,
  });
});

async function buildReportPdf(
  orgName: string,
  stats: { total_analyzed: number; never_followed_up: number; consulted_never_retained: number; went_cold: number; retained: number; reengageable_count: number },
  sample: { name: string; service: string | null; days_dormant: number; consulted: boolean }[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 740;

  const draw = (text: string, opts: { size?: number; bold?: boolean; muted?: boolean; gap?: number } = {}) => {
    if (y < 70) { page = pdf.addPage([612, 792]); y = 740; }
    const size = opts.size ?? 11;
    const f = opts.bold ? bold : font;
    const color = opts.muted ? rgb(0.6, 0.71, 0.68) : rgb(0.04, 0.18, 0.17);
    page.drawText(text, { x: 56, y, size, font: f, color });
    y -= opts.gap ?? size + 8;
  };
  const statLine = (label: string, value: number) => draw(`${String(value).padStart(5, " ")}   ${label}`, { size: 13, gap: 20 });

  draw(orgName, { size: 20, bold: true, gap: 26 });
  draw("Lead Leak Report", { size: 14, muted: true, gap: 18 });
  draw(`Generated ${new Date().toLocaleDateString("en-CA")}. Based on the record as entered, not an audit or advice.`, { size: 9, muted: true, gap: 26 });

  draw("WHAT THE RECORD SHOWS", { size: 9, bold: true, gap: 16 });
  statLine("leads analyzed", stats.total_analyzed);
  statLine("never received a follow up", stats.never_followed_up);
  statLine("had a consultation but never retained", stats.consulted_never_retained);
  statLine("went cold after real contact", stats.went_cold);
  statLine("currently retained", stats.retained);
  y -= 6;
  draw(`${stats.reengageable_count} leads appear worth a second look`, { size: 13, bold: true, gap: 22 });

  y -= 6;
  draw("TOP CANDIDATES FOR RE-ENGAGEMENT", { size: 9, bold: true, gap: 16 });
  if (sample.length === 0) {
    draw("None identified from the data provided.", { size: 10, gap: 14 });
  }
  for (const s of sample) {
    draw(`- ${s.name}${s.service ? ", " + s.service.replace(/_/g, " ") : ""}, ${s.days_dormant} days since contact${s.consulted ? ", consultation completed" : ""}`, { size: 10, gap: 14 });
  }

  y -= 10;
  draw("This report reflects what was entered for each lead. It does not assess", { size: 8, muted: true, gap: 11 });
  draw("eligibility or predict outcomes. Recontacting anyone remains your decision.", { size: 8, muted: true, gap: 11 });
  draw("Orbit, Victoria BC.", { size: 8, muted: true, gap: 11 });

  return pdf.save();
}

function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
