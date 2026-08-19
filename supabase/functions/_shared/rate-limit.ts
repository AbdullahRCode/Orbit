// Shared rate limit check for public, unauthenticated functions. Fails open
// (allows the request) if the check itself errors, so a database hiccup
// never takes down a public form. sb must be a service-role client, since
// rate_limits has no client-facing RLS policy.
// deno-lint-ignore no-explicit-any
export async function withinRateLimit(
  sb: any,
  scope: string,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const { count, error } = await sb.from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("scope", scope).eq("bucket_key", bucketKey).gte("created_at", since);
    if (error) return true;
    if ((count ?? 0) >= limit) return false;
    await sb.from("rate_limits").insert({ scope, bucket_key: bucketKey });
    return true;
  } catch {
    return true;
  }
}

// Best-effort client identifier. Not perfect behind shared proxies, good
// enough to blunt scripted abuse. Never used for anything security-critical
// beyond throttling.
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  return ip;
}
