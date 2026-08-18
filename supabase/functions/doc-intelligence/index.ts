// doc-intelligence v2: reads one uploaded document with AI and writes a short factual summary.
// No longer emails per document; digest-sweep sends one consolidated email per lead.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ANALYZABLE = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("ORBIT_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-orbit-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const docId = typeof b.document_id === "string" ? b.document_id : "";
  if (!docId) return json({ error: "document_id required" }, 400);

  const { data: doc } = await sb.from("documents")
    .select("id, org_id, lead_id, requirement_code, file_name, storage_path, mime_type, size_bytes")
    .eq("id", docId).maybeSingle();
  if (!doc) return json({ error: "document not found" }, 404);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  let summary = "Awaiting human review.";

  if (apiKey && ANALYZABLE.has(doc.mime_type ?? "") && doc.size_bytes < 9 * 1024 * 1024) {
    try {
      const { data: file, error } = await sb.storage.from("client-docs").download(doc.storage_path);
      if (error || !file) throw new Error("download failed");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const b64 = btoa(bin);
      const block = doc.mime_type === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
        : { type: "image", source: { type: "base64", media_type: doc.mime_type, data: b64 } };

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 220,
          system: "You review one uploaded file for an immigration consultation prep checklist. Reply in 60 words or fewer, sentence case, no em dashes. State: what the document appears to be, whether it is legible and complete, the name shown if visible, any visible dates including expiry, and any concern (blurry, cropped, expired, wrong document for the expected slot). State facts only. Never assess eligibility or give advice.",
          messages: [{ role: "user", content: [
            block,
            { type: "text", text: `Expected document slot: ${doc.requirement_code || "unspecified"}. File name: ${doc.file_name}.` },
          ]}],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = (data.content?.[0]?.text ?? "").trim();
        if (text) summary = text;
      }
    } catch { /* keep awaiting-review fallback */ }
  } else if (!ANALYZABLE.has(doc.mime_type ?? "")) {
    summary = "File type not machine readable, needs human review.";
  }

  await sb.from("documents").update({ ai_summary: summary }).eq("id", doc.id);
  await sb.from("audit_logs").insert({
    org_id: doc.org_id, actor_type: "agent", actor: "doc-intelligence",
    action: "document_reviewed", subject_type: "document", subject_id: doc.id,
    detail: { requirement_code: doc.requirement_code },
  });


  return json({ ok: true, summary });
});

function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
}
