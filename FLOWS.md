# Orbit flow tree

Every entry point, every branch, every outcome. If a path is not on this tree, it is not designed yet and must be added here before it is built.

## 1. Entry points

```
VISITOR
├── Marketing site (/)
│   ├── reads pages → Book an intelligence audit (cal.com)  [B2B: the consultant firm]
│   ├── footer → Client portal (/portal)                     [B2C: the firm's lead]
│   └── footer → Team sign in (/app)                         [the firm's staff]
│
├── Client portal (/portal)
│   ├── New person → Start
│   │   ├── Step 1 service: express entry | study | work | spousal | visitor | citizenship | other
│   │   │   └── other → free text "describe what you need" becomes required
│   │   ├── Step 2 country (required)
│   │   ├── Step 3 goal + timeline (required) + status now (required)
│   │   ├── Step 4 account: name, email, phone, password (all required) + consent (required)
│   │   │   ├── account created → checklist
│   │   │   ├── account exists → checklist + "sign in next time" notice
│   │   │   └── account failed → checklist still works via token, office can resend access
│   │   └── Checklist
│   │       ├── upload per slot → AI review (doc-intelligence) → digest email to firm
│   │       ├── anything else slot (optional, multiple files)
│   │       ├── note to consultant (saved to profile)
│   │       ├── portal guide chat (see 3)
│   │       ├── Submit to your consultant → stage qualified → confirmation shown
│   │       └── Book a consultation (cal.com)
│   ├── Returning person → I have an account → sign in → resume checklist
│   └── Private link (?t=token) → resume checklist
│
├── Instagram DM (via ManyChat when a firm is wired)
│   └── orbit-ingest buffers → smart delay → orbit-reply
│       ├── normal inquiry → qualify (max 3 questions) → booking offer
│       ├── advice shaped → warm refusal → booking + escalate if guard trips
│       ├── distress | refusal | scam | complaint → escalate → instant email to firm
│       └── spam → one polite reply, stop
│
└── Website form (web-lead) → lead created → digest email
```

## 2. Notifications (one email per lead per burst)

```
ACTIVITY (new lead, uploads, note, submit)
└── digest-sweep (every 10 min, 8 min quiet window)
    └── ONE branded email: profile rows + each doc with AI review + attention flags
ESCALATION (human_needed flips on)
└── instant email, always
DAILY
└── daily-briefing 8am Pacific → briefing saved + shown in /app
```

## 3. Portal guide chat (24/7 admin, not sales, not consultant)

```
MESSAGE
├── explains portal, documents in general terms, next steps, booking
├── other language → replies in that language
├── case specific | chances | strategy → "your consultant covers that" + booking
├── distress | scam | complaint | refusal words → escalate + kind acknowledgment
└── every reply → guard regexes → breach = replaced reply + escalate + audit
```

## 4. Consultant command center (/app), one per firm, isolated by RLS

```
SIGN IN (Supabase Auth, allowlisted staff only)
├── Stats: new 24h, qualified, consultations, needs you, approvals
├── Needs you queue → Handled
├── Approvals → Approve | Reject (L2); L3 never automates
├── Pipeline (recent leads)                     [v5: click into lead detail]
├── Documents + AI reviews → View (2 min signed URL, logged)
├── Audit trail (append only)
└── Latest daily briefing
```

## 5. Lead lifecycle

```
new → qualifying → qualified (submit or consultant) → booked → consulted → retained → handoff export
                                              └────────────→ lost | not_a_lead
retained → export profile PDF + docs zip + webhook to the firm's case management  [roadmap]
```

## 6. Data and trust

```
EVERY ACTION → audit_logs (who, what, when)
FILES → private bucket, signed URLs only, org and lead scoped paths
PROCESSORS → Supabase, Anthropic (no training on API inputs by default), Resend
CONSENT → captured in wizard, stored on lead
```
