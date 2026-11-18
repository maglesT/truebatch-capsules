-- A batch row is written once, at issue; everything after it is an event (step_events, batch_events). The owner could
-- still UPDATE, DELETE or TRUNCATE batches: insert-only, as its events are (port of Tablets round 34).
create trigger batches_insert_only before update or delete or truncate on batches
  for each statement execute function refuse_change();
