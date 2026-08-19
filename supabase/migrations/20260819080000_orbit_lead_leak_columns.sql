-- Lead leak diagnostic support. Applied 2026-08-19.
-- Adds the observable business events needed to score imported leads:
-- when they were last actually contacted, whether a consultation happened,
-- whether a fee quote went out, and what became of them. Existing leads
-- are unaffected, these columns default to null/none.
alter table public.leads
  add column last_contact_at timestamptz,
  add column consultation_status text not null default 'none'
    check (consultation_status in ('none','booked','completed','no_show')),
  add column quote_sent_at timestamptz,
  add column outcome text,
  add column import_batch text;
create index leads_org_import_batch on public.leads(org_id, import_batch) where import_batch is not null;
