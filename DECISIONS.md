# ORBIT decision log

Append only, newest first. Format: date | decision | reason | supersedes. When a decision here changes current state, CLAUDE.md must be updated in the same session.

2026-08-17 | Backend v1 deployed live to hpaxoxnwffzxginnbpgy via MCP: core schema migration plus web-lead, orbit-ingest, orbit-reply, daily-briefing. | Abdullah asked for the backend built end to end. Safe by default without API keys. | None.

2026-08-17 | Real time conversational replies are level 1 (no per-message approval); system-initiated outbound is level 2 via the approvals table. | A live chat assistant cannot wait for approval per message. Walls are enforced in prompt plus code guards, fully audited, escalation flags human_needed. | Refines the approval levels in COMPLIANCE.md.

2026-08-17 | Function auth pattern: verify_jwt false with x-orbit-secret header checked against ORBIT_WEBHOOK_SECRET. web-lead stays public with honeypot. | Webhooks and public forms cannot carry Supabase JWTs. | None.

2026-08-17 | ORBIT is a standalone product brand, not a LogorhythmX product line. | Abdullah's call. Cleaner positioning for a regulated B2B vertical. | Resolves the open brand decision.

2026-08-17 | Design system "glacier": ice, mist, pine, sage, current teal, glint turquoise. Newsreader display plus Instrument Sans. Signature element: the practice radar canvas. | Abdullah asked for lighter teal or turquoise direction and delegated finals. Distinct from LogorhythmX ivory and charcoal. | Resolves the visual identity decision.

2026-08-17 | Marketing site ships as static HTML, CSS and JS on Vercel with cleanUrls. Framework decision deferred to the dashboard phase. | Matches the proven static-plus-edge-functions pattern, zero build friction, instant deploys. | None.

2026-08-17 | Infrastructure recorded: Supabase project hpaxoxnwffzxginnbpgy, repo github.com/AbdullahRCode/Orbit. | Provided by Abdullah this session. | None.

2026-08-17 | Staged pivot to the RCIC vertical. Renovation continues as low-effort fallback for max 90 days. | Research verdict: better economics, market density, and a defensible compliance moat. | Supersedes the renovation-only niche commitment.

2026-08-17 | Flat-fee pricing only. Published: Foundation $1,500, Growth $3,500, Scale custom. | CICC Code s.13 bars referral inducements. Tiers unvalidated until sold. | None.

2026-08-17 | Agents implemented as edge functions and scheduled jobs. The 100-agent taxonomy is sales language only. | Cost control and engineering honesty. | None.

2026-08-17 | The ORBIT assistant discloses its automated nature. | Regulated vertical. Concealment is liability. | Partially supersedes the Hali never-say-AI rule, for ORBIT only.

2026-08-17 | Separate Supabase project for ORBIT. | Tenant isolation. No mixing with LogorhythmX data. | None.

2026-08-17 | Phase gate: one flagship pilot RCIC before full build-out. Kill benchmark: zero attributed files in 90 days of pilot. | Avoid building in a vacuum at zero revenue. | None.
