// Shared SSRF guard for org-configured outbound webhook URLs (retainer
// export, future integrations). An admin sets these, but "requires admin
// access" is not the same as "safe to fetch blindly": this blocks the
// obvious internal-network and localhost targets before we ever call fetch.
export function isSafeWebhookUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Block literal IPs in private/loopback/link-local ranges. Real DNS
  // rebinding is out of scope for a hobby-scale defense, this stops the
  // obvious cases: pasted internal IPs and loopback.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 127 || a === 10 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  if (host === "::1" || host === "0.0.0.0") return false;
  return true;
}
