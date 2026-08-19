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
6e. DONE. v12: fixed the 7 findings from the technical audit. Critical: site-chat now captures every conversation as a lead against orbit-hq (Orbit's own top-of-funnel), previously it made zero database writes despite its own prompt claiming otherwise; contact.html now has a real form posting to web-lead, which was fully built and tested but unreachable from the live site. Moderate: portal-intake now rate limited like every other public endpoint; the compliance output guard is consolidated into supabase/functions/_shared/compliance-guard.ts, one source of truth across orbit-reply, portal-chat and site-chat, closing the gap where site-chat's copy was missing 3 of 7 forbidden patterns; retainer-export's webhook now runs through supabase/functions/_shared/ssrf-guard.ts before any fetch; PDF generation in retainer-export and lead-leak-report no longer crashes on non-Latin script names, it falls back to a bracketed marker on that one page only, the real name stays exact everywhere else in the system; rate_limits_prune() is now actually scheduled via pg_cron, it existed since v10 but was never called.
6d. DONE. v11: Lead Leak Report, the actual first product per the repositioning. /leads-import.html: CSV import of historical leads (lead-import function, org scoped, never touches active case files) followed by lead-leak-report, which scores the record against observable events only, never followed up, consulted but never retained, went cold after real contact, and surfaces a ranked reengageable list. Produces both JSON for the UI and a PDF one-pager for the actual sales pitch. No revenue numbers are promised anywhere in the output, the report states plainly it reflects the record as entered, not an audit or advice. New leads columns: last_contact_at, consultation_status, quote_sent_at, outcome, import_batch. This replaces "revenue recovery" as a pitch with "diagnostic first, reactivation only if the data supports it."
6c. DONE. v10: security hardening plus multilingual support. Shared rate limit helper (supabase/functions/_shared/rate-limit.ts) backed by a new rate_limits table, wired into web-lead, site-chat and orbit-ingest (all public entry points) with sensible per-window caps, fails open so a database hiccup never blocks a real submission. orbit-reply, portal-chat and site-chat now explicitly instruct fluent reply in the person's own language, naming Hindi, Punjabi, Mandarin, Cantonese, Tagalog, Spanish, Vietnamese, Korean, Arabic, French and Portuguese as a baseline given Canadian immigration's actual source-country mix, not just a generic "adapt to their language" line. Marketing site widget adds a rotating invite bubble cycling the same greeting through those languages every 5 seconds. Published orbit-security-compliance-overview.docx, a factual, non-certified security and compliance one-pager for evaluating firms, describing controls as actually built, explicitly stating no SOC 2 certification exists yet. Multi-tenant billing, staff roles and self-serve onboarding remain deliberately deferred until a second and third firm ask, per the phase gate.
6b. DONE. v9: retainer handoff export live. "Export retainer package" button in /app lead detail calls retainer-export (JWT required, RLS scoped, no service role exposed to the browser). Generates a one page profile PDF plus a zip of every original document, uploads to the private exports bucket, returns a 24 hour signed download link. If organizations.settings has retainer_webhook_url set, the same summary posts there for Zapier or any case management tool to pick up. Logged to lead_events (retainer_exported) and audit_logs. Source: supabase/functions/retainer-export/, supabase/migrations/20260818090000_orbit_retainer_export.sql.
7e. DONE. v8: applicant knowledge canon live. 31 verified MAY-answer knowledge_items rows (global, official_source, expires 2026-11-17) loaded from the 2026-08-17 research report. portal-chat and orbit-reply now pull the canon at runtime and merge org specific items, answer general questions with official canada.ca sources, never quote annually changing figures inline, recognize applicant vocabulary (visa, PR, file, agent, points), use the validate then fact then escalate pattern for anxious people, proactively surface CICC register and no-guarantee lines on scam fear, and carry expanded escalation triggers (am I eligible, do I qualify, my chances, which program is best, should I apply, will I be approved, ghost consultant). QUARTERLY TASK: re-verify all knowledge rows with an RCIC before 2026-11-17.
7d. DONE. v7 part 1: global [hidden] CSS fix (display rules were overriding the hidden attribute, which made modals and chat panels permanently mounted and click blocking; every cross, viewer and chat symptom traced to this one line), portal guide now responds helpfully pre-wizard, and site-chat is live: Orbit concierge widget on all five public pages, sales-side knowledge (offering, divisions, pricing, compliance stance, security, audit CTA), fact-locked prompt, output guard, stateless with page-held history. UI contract added: any element using the hidden attribute must never also carry a conflicting display rule without the global fix.
7c. DONE. v6: clickable lead detail in /app (full profile, documents with AI reviews and versions, conversation, stage select forward or back by consultant choice, needs-a-human toggle), in-app document viewer modal (signed URL in iframe, no new tab), audit trail capped scrollable, division names surfaced on dashboard sections and audit actors (Pulse, Nexus, Sentinel, Orbit), portal guide renamed Orbit with a 20 message daily cap per client.
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
