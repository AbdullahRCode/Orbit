// Shared compliance output guard. Every AI-generated reply that could reach
// a client or prospect passes through this before it goes out, regardless
// of which surface produced it. Previously each function kept its own copy;
// site-chat's copy had drifted and was missing patterns the other two
// enforced, which is exactly the kind of gap this file exists to prevent.
export const FORBIDDEN_OUTPUT: RegExp[] = [
  /you (are|'re)\s+(likely\s+|probably\s+)?(eligible|qualified)/i,
  /you\s+qualify/i,
  /your\s+(best|ideal)\s+(option|pathway|program)\s+is/i,
  /i\s+recommend\s+(applying|the)\s/i,
  /guarantee/i,
  /\b\d{2,3}\s?%\s+(success|approval|chance)/i,
  /(approved|endorsed|affiliated)\s+(by|with)\s+(the\s+)?(government|ircc)/i,
];

export function violatesOutputGuard(text: string): boolean {
  return FORBIDDEN_OUTPUT.some((r) => r.test(text));
}
