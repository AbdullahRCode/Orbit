# ORBIT compliance walls

Verified 2026-08-17. Re-verify every 90 days or on any CICC or IRCC announcement. Never write client-facing copy, prompts, or outreach without reading this file. Get formal legal review before first paying client.

## The one law that matters most
IRPA s.91: only lawyers, Quebec notaries, law society paralegals, and CICC licensees may advise or represent on immigration matters for a fee. Penalties up to $200,000 and two years imprisonment. ORBIT, Abdullah, and the AI are none of these.

Operational meaning:
- The AI never assesses eligibility, never recommends a pathway, never says "you qualify" or anything close.
- Allowed: general public information citing official sources (canada.ca, IRCC), collecting facts, qualifying against the firm's own intake criteria, booking, reminders.
- Anything approaching advice escalates to the RCIC. Hard-coded in prompts and tested before every deploy.

## CICC Code of Professional Conduct (SOR/2022-128)
- s.44: no guarantees of success, no implied relationship with government, marketing must be professional and in the public interest.
- s.44 to 46: licensee's registered name at the start of ads, written ads include the College public register URL, testimonials must be genuine and actually given by clients.
- s.13: no inducements for referrals. Therefore ORBIT pricing is flat-fee only. Never per-lead.
- The licensee remains responsible for their agents' actions. Therefore every AI action is written to audit_logs and substantive client-facing sends require human approval.

## Privacy (PIPEDA plus BC PIPA)
Immigration client data is highly sensitive. Requirements: consent and purpose limitation, breach notification, signed data processing agreement with every client firm, minimal retention, secure disposal. Open item: data residency for AI calls processing client PII in the US. Resolve before first paying client.

## CASL (ORBIT's own outreach)
Implied consent via conspicuously published business email relevant to the recipient's role. Every send carries full identification footer and a working unsubscribe honored within 10 business days. The 10 per day limit and suppression list stand. Penalties reach $10M per violation for a business.

## Meta and WhatsApp platform rules
Instagram and Messenger: automated replies only within 24 hours of the user's last message. No promotional re-engagement outside the window. Automated experiences must be disclosable.
WhatsApp Business API: per-message pricing since July 2025, service window billing changes October 2026. Build the cost model before enabling WhatsApp.

## Approval levels
- L1 automatic: classification, tagging, research, internal summaries, analytics.
- L2 human approval (Abdullah or the firm): any external message, content publication, follow-up sends.
- L3 RCIC only: anything touching advice, submissions, or professional judgment. Never automated. Never bypassed.

## Disclosure rule (deliberate divergence from LogorhythmX)
The ORBIT assistant identifies itself as a digital assistant when asked and on first contact where required. In a regulated vertical, concealment is a liability, not a feature.
