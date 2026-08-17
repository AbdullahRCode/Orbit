// portal-upload v2: encrypted document upload via secure portal token, then fires
// doc-intelligence in the background so the consultant gets an AI review and an email.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-portal-token, x-file-name, x-requirement-code",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 40;
const ALLOWED = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const token = req.headers.get("x-portal-token") ?? "";
  const fileName = decodeURIComponent(req.headers.get("x-file-name") ?? "document").slice(0, 180);
  const reqCode = (req.headers.get("x-requirement-code") ?? "").slice(0, 60);
  const mime = req.headers.get("content-type") ?? "";

  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: "invalid link" }, 401);
  if (!ALLOWED.has(mime)) return json({ error: "file type not accepted. Use pdf, jpg, png, heic, webp or docx" }, 415);

  const { data: lead } = await sb.from("leads")
    .select("id, org_id").eq("portal_token", token).maybeSingle();
  if (!lead) return json({ error: "invalid link" }, 401);

  const { count } = await sb.from("documents")
    .select("id", { count: "exact", head: true }).eq("lead_id", lead.id);
  if ((count ?? 0) >= MAX_FILES) return json({ error: "upload limit reached, contact the office" }, 429);

  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return json({ error: "empty file" }, 400);
  if (buf.byteLength > MAX_BYTES) return json({ error: "file too large, 10 MB maximum" }, 413);

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${lead.org_id}/${lead.id}/${Date.now()}_${safeName}`;

  const { error: upErr } = await sb.storage.from("client-docs")
    .upload(path, buf, { contentType: mime, upsert: false });
  if (upErr) return json({ error: "upload failed, try again" }, 500);

  const { data: doc, error: docErr } = await sb.from("documents").insert({
    org_id: lead.org_id, lead_id: lead.id, requirement_code: reqCode || null,
    file_name: safeName, storage_path: path, mime_type: mime, size_bytes: buf.byteLength,
  }).select("id").single();
  if (docErr) return json({ error: "could not record upload" }, 500);

  await sb.from("audit_logs").insert({
    org_id: lead.org_id, actor_type: "system", actor: "portal-upload",
    action: "document_received", subject_type: "document", subject_id: doc.id,
    detail: { lead_id: lead.id, requirement_code: reqCode, size_bytes: buf.byteLength },
  });
  await sb.from("lead_events").insert({
    org_id: lead.org_id, lead_id: lead.id, type: "document_uploaded",
    payload: { requirement_code: reqCode, file_name: safeName },
  });

  // background AI review plus office notification
  const base = Deno.env.get("SUPABASE_URL");
  const review = fetch(`${base}/functions/v1/doc-intelligence`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-orbit-secret": Deno.env.get("ORBIT_WEBHOOK_SECRET") ?? "" },
    body: JSON.stringify({ document_id: doc.id }),
  }).catch(() => {});
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === "function") rt.waitUntil(review);

  return json({ ok: true, document_id: doc.id });
});

function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
