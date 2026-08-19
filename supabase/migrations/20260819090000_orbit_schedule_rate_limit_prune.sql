-- Schedules the prune function that already existed but was never called,
-- so rate_limits does not grow unbounded. Applied 2026-08-19.
select cron.schedule('orbit-rate-limits-prune', '30 8 * * *', $$select private.rate_limits_prune();$$);
