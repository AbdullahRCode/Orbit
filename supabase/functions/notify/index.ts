// notify: sends an operational email to the organization via Resend.
// Internal only: requires x-orbit-secret. No client data beyond what the caller includes.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("ORBIT_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-orbit-secret") !== secret) return json({ error: "unauthorized" }, 401);

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ skipped: "no RESEND_API_KEY set" });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const to = typeof b.to === "string" && b.to.includes("@") ? b.to : "abdullah@logorhythmx.com";
  const subject = (typeof b.subject === "string" ? b.subject : "Orbit notification").slice(0, 140);
  const text = (typeof b.text === "string" ? b.text : "").slice(0, 4000);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Orbit <abdullah@logorhythmx.com>", to: [to], subject, text }),
  });
  return json({ ok: res.ok, status: res.status });
});

function json(d: unknown, status = 200): Response {
  return new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
}
