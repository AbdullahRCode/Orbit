// retainer-export: builds the pre-retainer handoff package for one lead.
// A signed-in consultant calls this from /app. The function generates a
// profile summary PDF, zips it together with every original document the
// client uploaded, stores the package in the private "exports" bucket, and
// returns a 24 hour signed URL. If the org has a retainer_webhook_url set in
// organizations.settings, the same package summary is posted there so a tool
// like Zapier can pick it up automatically. This is a handoff, not a sync:
// Orbit never writes back into the firm's case management tool.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import JSZip from "npm:jszip@3.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sbAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  // Scoped to the calling consultant's session, so every query below is
  // already restricted to their org by RLS. No manual org check needed.
  const sbUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const leadId = typeof b.lead_id === "string" ? b.lead_id : "";
  if (!leadId) return json({ error: "lead_id required" }, 400);

  const { data: lead, error: leadErr } = await sbUser.from("leads")
    .select("id, org_id, full_name, email, phone, service_interest, country, goal, timeline, current_status, notes, stage, created_at")
    .eq("id", leadId).maybeSingle();
  if (leadErr || !lead) return json({ error: "lead not found or not permitted" }, 404);

  const { data: docs } = await sbUser.from("documents")
    .select("id, file_name, storage_path, requirement_code, uploaded_at")
    .eq("lead_id", leadId).order("uploaded_at");

  const { data: org } = await sbUser.from("organizations")
    .select("name, settings").eq("id", lead.org_id).maybeSingle();

  const pdfBytes = await buildProfilePdf(lead, docs ?? [], org?.name ?? "Orbit");

  const zip = new JSZip();
  zip.file("profile.pdf", pdfBytes);
  let docErrors = 0;
  for (const d of docs ?? []) {
    const { data: fileData, error: dlErr } = await sbAdmin.storage.from("client-docs").download(d.storage_path);
    if (dlErr || !fileData) { docErrors++; continue; }
    const buf = new Uint8Array(await fileData.arrayBuffer());
    zip.file(safeZipName(d.file_name, d.id), buf);
  }
  const zipBytes = await zip.generateAsync({ type: "uint8array" });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${lead.org_id}/${lead.id}/retainer-export-${stamp}.zip`;
  const { error: upErr } = await sbAdmin.storage.from("exports")
    .upload(path, zipBytes, { contentType: "application/zip", upsert: false });
  if (upErr) return json({ error: "export build failed" }, 500);

  const { data: signed } = await sbAdmin.storage.from("exports").createSignedUrl(path, 60 * 60 * 24);

  await sbAdmin.from("lead_events").insert({
    org_id: lead.org_id, lead_id: lead.id, type: "retainer_exported",
    payload: { doc_count: (docs ?? []).length, doc_errors: docErrors, path },
  });
  await sbAdmin.from("audit_logs").insert({
    org_id: lead.org_id, actor_type: "user", actor: "consultant",
    action: "retainer_export", subject_type: "lead", subject_id: lead.id,
    detail: { doc_count: (docs ?? []).length, doc_errors: docErrors },
  });

  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const webhookUrl = typeof settings.retainer_webhook_url === "string" ? settings.retainer_webhook_url : "";
  let webhookSent = false;
  if (webhookUrl.startsWith("http")) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "retainer_export",
          lead: {
            id: lead.id, full_name: lead.full_name, email: lead.email, phone: lead.phone,
            service: lead.service_interest, country: lead.country, stage: lead.stage,
          },
          document_count: (docs ?? []).length,
          export_url: signed?.signedUrl ?? null,
          expires_in_hours: 24,
        }),
      });
      webhookSent = true;
    } catch {
      // webhook is best effort, it never blocks the export itself
    }
  }

  return json({
    ok: true,
    download_url: signed?.signedUrl ?? null,
    expires_in_hours: 24,
    document_count: (docs ?? []).length,
    document_errors: docErrors,
    webhook_sent: webhookSent,
  });
});

function safeZipName(name: string, id: string): string {
  const safe = (name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safe.slice(0, 80)}_${id.slice(0, 8)}`;
}

type LeadRow = {
  full_name: string | null; email: string | null; phone: string | null;
  service_interest: string | null; country: string | null; goal: string | null;
  timeline: string | null; current_status: string | null; notes: string | null; stage: string;
};
type DocRow = { file_name: string; requirement_code: string | null };

async function buildProfilePdf(lead: LeadRow, docs: DocRow[], orgName: string): Promise<Uint8Array> {
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

  draw(orgName, { size: 20, bold: true, gap: 26 });
  draw("Retainer handoff profile", { size: 12, muted: true, gap: 20 });
  draw(`Generated ${new Date().toLocaleDateString("en-CA")}`, { size: 9, muted: true, gap: 22 });

  const field = (label: string, value: unknown) => {
    draw(label.toUpperCase(), { size: 9, bold: true, gap: 13 });
    draw(String(value ?? "-"), { size: 11, gap: 18 });
  };
  field("Full name", lead.full_name);
  field("Email", lead.email);
  field("Phone", lead.phone);
  field("Service interest", lead.service_interest);
  field("Country", lead.country);
  field("Current status", lead.current_status);
  field("Goal", lead.goal);
  field("Timeline", lead.timeline);
  field("Stage at export", lead.stage);
  field("Consultant notes", lead.notes || "None");

  y -= 4;
  draw("DOCUMENTS INCLUDED", { size: 9, bold: true, gap: 14 });
  if (docs.length === 0) draw("None uploaded.", { size: 10, gap: 16 });
  for (const d of docs) {
    draw(`- ${d.file_name}${d.requirement_code ? " (" + d.requirement_code.replace(/_/g, " ") + ")" : ""}`, { size: 10, gap: 14 });
  }

  y -= 10;
  draw("This document contains factual intake information only. No eligibility", { size: 8, muted: true, gap: 11 });
  draw("assessment or immigration advice is included. Orbit, Victoria BC.", { size: 8, muted: true, gap: 11 });

  return pdf.save();
}

function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
