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
6. Every live deploy via MCP (migration or edge function) must be mirrored into supabase/ in the repo in the same session, before the handoff zip is produced. The repo and the deployed system are never allowed to drift.

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
4. DONE. Client portal (portal.html): guided wizard, per service document checklists, encrypted uploads via secure 256-bit link, progress ring, consent capture. Consultant command center (app.html): Supabase Auth login, stats, needs-you queue, approvals, pipeline, documents with signed URL viewing, audit trail, latest briefing. Backing: migration 2 (documents, document_requirements, allowed_admins, auth trigger, client-docs private bucket 10MB limit) plus portal-intake, portal-upload, portal-status functions, all live.
5. DONE. Scheduling live via pg_cron plus pg_net: digest-sweep every 10 minutes, daily-briefing at 15:00 UTC (8am Pacific daylight time; change to 16:00 UTC when PST returns). Webhook secret mirrored in private.app_secrets for cron calls.
6b. NEXT. Retainer handoff export: profile PDF plus documents zip, and a generic webhook for Zapier into any case management tool.
7b. DONE. v5: submit-for-review flow (stage moves forward only, never backward, confirmation shown, resume aware), required free-text need on the other path, FLOWS.md system tree (every path must exist there before it is built), tests/smoke.sh live end to end test with compliance trap assertions, tests/personas.md 12 persona matrix. Claude Code runs tests with: ORBIT_SECRET=<secret> bash tests/smoke.sh.
7a. DONE. v4: one branded HTML digest email per lead (digest-sweep, 8 minute quiet window) replaces per-event emails; per-doc and per-lead instant emails removed from doc-intelligence and portal-intake; escalation emails stay instant. notify v2 renders glacier-branded HTML with pointer rows and optional CTA (CTA needs settings.app_url set once the domain or Vercel URL is known). Portal guide chat live on the checklist step via portal-chat: compliance gated 24/7 admin concierge, multilingual, emotion aware, never advice.
7. DONE. v3: client accounts (Supabase Auth via portal-intake admin creation, client_accounts table, client RLS read), doc-intelligence function (AI reads each upload, writes factual 60 word summary to documents.ai_summary, never assesses eligibility), notify function (Resend email to org notify_email on new lead, new document, escalation), portal required fields, note to consultant, additional uploads slot, pain-first H1, nav button contrast bug fixed, data processors section on compliance page, Team sign in footer link.
8. ROADMAP (in rough order): interactive lead detail in /app (click lead: profile, docs, conversation, stage change, notes), employer and LMIA entry path with its own checklist, daily-briefing 8am cron, IRCC change monitoring feeding the briefing, retainer export handoff, e-signatures for retainers, consultation payments, multi-staff roles, SMS notifications, SOC 2 style security posture document, client password reset flow.
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

## Integration stance (verified 2026-08-17)
Orbit neither builds case management nor depends on case management APIs. Docketwise exposes Zapier only; Officio's API is thin. V1 integration is a clean retainer handoff: export (profile PDF plus documents zip) and a webhook any tool can consume. Deep sync is built only when a paying firm demands it. The client portal covers pre-retainer intake and consultation prep documents only; post-retainer document management belongs to the firm's case management tool.

## Backend behavior rules (verified 2026-08-17)
- Real time conversational replies to user-initiated messages are level 1: allowed without per-message approval because walls are enforced in prompt and code, everything is audited, and escalation flags human_needed. System-initiated outbound (follow ups, campaigns) is level 2 and must go through the approvals table. Level 3 never automates.
- The output guard regexes in orbit-reply are a hard floor. Never remove them. Extend them when new failure patterns appear.
- All secrets live in Supabase dashboard secrets only. Never in code, never in the repo.

## Open decisions and TODOs (blockers marked with ⛔)
- ⛔ Buy the ORBIT domain, then replace every "orbit.example" placeholder in canonical tags, robots.txt and sitemap.xml.
- Create ORBIT email (hello@ the domain) and swap the mailto on contact.html.
- Create an Orbit-branded cal.com event and swap the booking link.
- Dashboard visual identity: extend glacier onto a dark command-center variant when the dashboard phase starts.
