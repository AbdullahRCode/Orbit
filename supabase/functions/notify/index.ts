// notify v2: branded HTML email via Resend. Accepts intro, pointer rows, optional CTA.
// Internal only: requires x-orbit-secret.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("ORBIT_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-orbit-secret") !== secret) return json({ error: "unauthorized" }, 401);

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ skipped: "no RESEND_API_KEY set" });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const to = typeof b.to === "string" && b.to.includes("@") ? b.to : "abdullah@logorhythmx.com";
  const subject = (typeof b.subject === "string" ? b.subject : "Orbit update").slice(0, 140);
  const intro = typeof b.intro === "string" ? b.intro.slice(0, 500) : "";
  const ctaUrl = typeof b.cta_url === "string" && b.cta_url.startsWith("http") ? b.cta_url : "";
  const rows = Array.isArray(b.rows) ? (b.rows as { k?: string; v?: string }[]).slice(0, 20) : [];
  const text = typeof b.text === "string" ? b.text.slice(0, 4000) : "";

  const rowHtml = rows.map((r) => `
    <tr>
      <td style="padding:9px 0;border-top:1px solid #e6f2ef;color:#0b7c6f;font-weight:600;font-size:13px;vertical-align:top;width:130px;">${esc(r.k ?? "")}</td>
      <td style="padding:9px 0 9px 14px;border-top:1px solid #e6f2ef;color:#0b2e2b;font-size:14px;line-height:1.5;">${esc(r.v ?? "")}</td>
    </tr>`).join("");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f3faf8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3faf8;padding:28px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="background:#0b2e2b;border-radius:16px 16px 0 0;padding:20px 28px;">
          <span style="font-family:Georgia,serif;font-size:22px;color:#f3faf8;">orbit</span>
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#7fe0d0;margin-left:6px;"></span>
        </td></tr>
        <tr><td style="background:#ffffff;padding:26px 28px;border:1px solid #cfe4df;border-top:0;border-radius:0 0 16px 16px;font-family:Arial,Helvetica,sans-serif;">
          <h2 style="margin:0 0 8px;font-family:Georgia,serif;font-weight:500;font-size:22px;color:#0b2e2b;">${esc(subject)}</h2>
          ${intro ? `<p style=\"margin:0 0 16px;color:#40605a;font-size:14px;line-height:1.6;\">${esc(intro)}</p>` : ""}
          ${rowHtml ? `<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">${rowHtml}</table>` : ""}
          ${text && !rowHtml ? `<p style=\"color:#0b2e2b;font-size:14px;line-height:1.6;white-space:pre-line;\">${esc(text)}</p>` : ""}
          ${ctaUrl ? `<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-top:20px;\"><tr><td style=\"background:#0b2e2b;border-radius:999px;\"><a href=\"${ctaUrl}\" style=\"display:inline-block;padding:12px 24px;color:#f3faf8;text-decoration:none;font-size:14px;font-weight:bold;\">Open command center</a></td></tr></table>` : ""}
          <p style="margin:22px 0 0;color:#9ab5af;font-size:11px;">Orbit, Victoria BC. Operational notification.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Orbit <abdullah@logorhythmx.com>", to: [to], subject,
      html, text: text || (intro + "\n" + rows.map((r) => `${r.k}: ${r.v}`).join("\n")),
    }),
  });
  return json({ ok: res.ok, status: res.status });
});

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
}
