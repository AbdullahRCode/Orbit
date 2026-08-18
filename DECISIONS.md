# ORBIT decision log

Append only, newest first. Format: date | decision | reason | supersedes. When a decision here changes current state, CLAUDE.md must be updated in the same session.

2026-08-17 | Submit-for-review added: explicit submission moment moves stage to qualified; stage never moves backward from portal saves. Other path requires free-text need. | Abdullah: every flow needs a closure moment and a structure; "other" was awkward. | None.

2026-08-17 | Test suite adopted: tests/smoke.sh (live end to end, compliance trap assertions) and tests/personas.md (12 persona matrix). Run before every release. | Prove it works, repeatably, including that walls hold. | None.

2026-08-17 | Notifications consolidated: one branded HTML digest per lead per activity burst (8 min quiet window, 10 min sweep), instant email only for escalations. | Five emails per lead is spam; Abdullah wants one, visual, skimmable. | Supersedes per-event emails.

2026-08-17 | Real scheduling adopted: pg_cron plus pg_net calling edge functions with the shared secret from private.app_secrets. Daily briefing scheduled 15:00 UTC. | Removes the missing-cron gap permanently. | None.

2026-08-17 | Portal guide chat added: 24/7 admin concierge on the checklist step, same legal walls and guards as orbit-reply, multilingual, escalates to human. Not a sales agent, not a consultant. | Abdullah wants a Hali-class guide for clients inside the portal. | None.

2026-08-17 | v3 adds client accounts with email and password, per Abdullah's overrule of link-only access. Secure links remain as a backup path. | Abdullah wants big-firm parity; accounts also enable future password reset and messaging. | Supersedes the link-only decision below.

2026-08-17 | Document intelligence live: every analyzable upload gets a factual AI summary for the consultant (type, legibility, dates, concerns). Never eligibility. Non-analyzable types marked for human review. | This is the admin-hours killer and a core sales asset. | None.

2026-08-17 | Email notifications live via Resend from abdullah@logorhythmx.com until the Orbit domain exists: new lead, new document with AI review, assistant escalation. | Consultants do not refresh dashboards; phone-native email is the v1 alert channel. SMS later. | None.

2026-08-17 | Client portal v1 uses secure 256-bit private links instead of passwords for end clients; password accounts are phase 2. | Password friction kills completion for immigrant leads. Link entropy matches password security, everything audited. | Refines Abdullah's login-password request, he approved building as judged necessary.

2026-08-17 | Integration stance: no case management build, no API dependency. V1 is export plus webhook handoff at retainer. Portal scope is pre-retainer only. | Docketwise is Zapier only, Officio thin. Avoids fighting giants and fragile dependencies. | Sharpens the sit-above founding rule.

2026-08-17 | Documents: private client-docs bucket, 10MB per file, 40 files per lead, allowlisted types, org and lead scoped paths, signed URLs for viewing, every access audited. Checklists seeded for 7 services from typical IRCC document lists. | Security and PIPEDA posture with easy client experience. | None.

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
