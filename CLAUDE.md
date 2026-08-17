# ORBIT project constitution

Read this file at the start of every session. It describes current state only. History lives in DECISIONS.md. Legal walls live in COMPLIANCE.md.

## What ORBIT is
AI revenue, growth and intelligence layer for Canadian immigration consultants (RCICs). Standalone product brand. Sits above case management software, never replaces it. Built and sold by Abdullah Khan (Victoria BC). ORBIT captures and qualifies leads, books consultations, runs compliant follow-up, and produces daily intelligence briefings with revenue attribution. ORBIT never gives immigration advice.

## Anti-staleness protocol (mandatory, this is the fix for haphazard files)
1. This file holds current state only. Never append history here. Log every change in DECISIONS.md instead.
2. If anything decided in a session contradicts this file, the session wins. Update this file and append the decision to DECISIONS.md in the same session, before any commit. Never leave them out of sync.
3. Every section carries a verified date. Refresh the date whenever you touch the section.
4. At session start, flag any section older than 60 days in: Current phase, Pricing, Integrations, Compliance pointers. Ask Abdullah to confirm or re-verify with search before relying on it.
5. Treat this file as a cache with expiry, not scripture.

## Hard rules (verified 2026-08-17)
- The AI never provides immigration advice, eligibility assessments, or representation. General information with official sources, intake, qualification, and booking only. Read COMPLIANCE.md before writing any client-facing copy or prompt.
- Flat-fee pricing only. Never per-lead or referral-based (CICC Code s.13).
- No guarantees of application success anywhere. No implied government affiliation.
- The ORBIT assistant discloses it is a digital assistant when asked or where required.
- Copy style: no em dashes, sentence case, no invented statistics, no AI-aesthetic visuals.
- Git: stage by explicit filename only, never git add -A. Claude never pushes. Abdullah pushes from PowerShell.
- Tenant isolation from day one. ORBIT runs on its own Supabase project. Never mixes with other business data.

## Design system: glacier (verified 2026-08-17)
- Colors: ice #f3faf8 (page), mist #e6f2ef (panels), pine #0b2e2b (ink), sage #51706a (muted), current #0f9d8c (accent), glint #7fe0d0 (glow, lines), line #cfe4df.
- Type: Newsreader (display, italics for accent words), Instrument Sans (body and UI). Sentence case everywhere.
- Signature element: the practice radar, a canvas animation of signal dots orbiting and being captured by the center. Wordmark: lowercase "orbit" with an orbiting dot on the ring mark.
- Voice: plain, confident, specific. Trust over hype. No robots, circuits, neon blue, fake dashboards, fake metrics or fake testimonials. Illustrative content is always labeled illustrative.
- Buttons: pill, pine fill with ice text, teal glow ring on hover. Cards lift with a teal underline sweep.

## Current phase (verified 2026-08-17)
Phase 0: foundation build plus flagship pilot hunt. Marketing site is built and ready to deploy.
Gate to Phase 1: one Metro Vancouver RCIC signed on a reduced-cost pilot.
Benchmark: 2+ attributed retained files within 60 days of pilot means commit fully. Zero attributed files in 90 days means reassess ICP and messaging.

## Build order (verified 2026-08-17)
1. DONE. Marketing site: static HTML/CSS/JS on Vercel with cleanUrls. Pages: home, how-it-works, compliance, pricing, contact.
2. DONE. Supabase schema live on hpaxoxnwffzxginnbpgy: 11 tables, RLS on all, audit_logs append-only from clients, orbit-hq tenant seeded. Source: supabase/migrations/.
3. DONE. Edge functions live (all verify_jwt false with x-orbit-secret header auth): web-lead (public form, honeypot, CORS), orbit-ingest (message buffer), orbit-reply (compliance gated assistant: prompt walls plus code-level output guards, input escalation triggers, atomic claim, 60-word hard cap, safe fallback without API key, full audit), daily-briefing (real counts only, upserts briefings table). Source: supabase/functions/.
4. NEXT. Dashboard: command center, leads, approvals queue, audit log viewer. Stack decision at that point.
5. NEXT. Schedule daily-briefing at 8am America/Vancouver (Supabase dashboard cron calling the function with the secret header).
6. NEXT. Wire ManyChat to orbit-ingest and orbit-reply when the pilot RCIC lands.

Agents are edge functions and scheduled jobs. The 100-agent taxonomy is sales positioning, never literal architecture.

## Stack (verified 2026-08-17)
- Supabase project id: hpaxoxnwffzxginnbpgy (ORBIT only, isolated).
- Repo: github.com/AbdullahRCode/Orbit (Abdullah pushes).
- Hosting: Vercel, static, cleanUrls true.
- Booking: cal.com/abdullah-logorhythmx/15min for now. TODO: Orbit-branded event.
- Email and Resend for ORBIT domain: pending domain purchase.
- Anthropic API for assistant and briefings. orbit-reply and daily-briefing use claude-sonnet-4-6. Required secrets in Supabase dashboard, never in code: ANTHROPIC_API_KEY, ORBIT_WEBHOOK_SECRET. Until set, the assistant answers with a safe human-handoff fallback and flags human_needed.

## Key numbers cache (verified 2026-08-17, source: market research report 2026-08-17)
About 12,000 RCICs in Canada, about 2,963 in BC, about 2,200 in Metro Vancouver (estimate). Client fees per file $1,500 to $7,000. ORBIT tiers as published on site: Foundation $1,500, Growth $3,500, Scale custom. Tiers are a hypothesis until validated by sales. Competitive gap: no compliance-aware growth and intelligence layer exists for RCICs.

## Backend behavior rules (verified 2026-08-17)
- Real time conversational replies to user-initiated messages are level 1: allowed without per-message approval because walls are enforced in prompt and code, everything is audited, and escalation flags human_needed. System-initiated outbound (follow ups, campaigns) is level 2 and must go through the approvals table. Level 3 never automates.
- The output guard regexes in orbit-reply are a hard floor. Never remove them. Extend them when new failure patterns appear.
- All secrets live in Supabase dashboard secrets only. Never in code, never in the repo.

## Open decisions and TODOs (blockers marked with ⛔)
- ⛔ Buy the ORBIT domain, then replace every "orbit.example" placeholder in canonical tags, robots.txt and sitemap.xml.
- Create ORBIT email (hello@ the domain) and swap the mailto on contact.html.
- Create an Orbit-branded cal.com event and swap the booking link.
- Dashboard visual identity: extend glacier onto a dark command-center variant when the dashboard phase starts.
