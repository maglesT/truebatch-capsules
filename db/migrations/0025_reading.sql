-- Round 46 (lead, for Operations' continued process verification, CPV): reading_v1, one row per recorded number of a
-- step signed done: every process parameter and in-process check value, as the record holds it now (a correction
-- replaces the value; `corrected` says so). A list of readings (20 capsule weights) gives one row per reading
-- (reading_no 1..n, in order); a single number reading_no 1. Its limits are the master step's, from the setting the
-- block checks it against (shared/engine/readings.ts): limit_of 'each' (a C1 on the value) or 'mean' (a T7 on the
-- list: the limit is the mean's, not each reading's); a limit the block writes itself (no leaking capsule: not more
-- than 0 nos); null when the block has no limit for it, the master left an optional limit unset, or the limit is not
-- a written one (an earlier step's result). low_limit and high_limit are in limit_unit, which may differ from unit
-- (a limit in kN, a reading in N): the reader converts, or compares only rows of one unit.
--   reading_id: '<batch number>/<stage.sub-batch.step.round>/<field>/<reading_no>';
--   stage: the stage's name; step: '<stage key>/<step key>' (as material_use_v1); step_name: "Stage › step", kept with
--   the step's start (as the other views); block: the block id ('capsule-fill', 'roller-compact');
--   parameter: the field's label (a "check a value" step: what the master says it checks); field: the field's name.
-- Nothing new is stored: derived from the insert-only step events (0018). reading_parameters (not published) is the
-- list of the number fields of the blocks a capsule master may use with their limit settings; a test compares it with
-- the blocks (test/readings.test.ts), so a new number field needs a migration replacing it. Columns are only ever
-- added at the end (0006). Capsules only: packing does not migrate this file.

-- In the product's own schema (created before the report schema is put first in search_path): not published.
create or replace view reading_parameters (block, field, label, limit_setting, fixed_limit, limit_of) as values
  ('weigh', 'assay', 'Assay (certificate)', null, null::jsonb, null),
  ('weigh', 'water', 'Water content (certificate)', null, null::jsonb, null),
  ('weigh', 'lod', 'Loss on drying (certificate)', null, null::jsonb, null),
  ('weigh', 'content', 'Content (certificate)', null, null::jsonb, null),
  ('weigh', 'gross', 'Gross weight', null, null::jsonb, null),
  ('weigh', 'tare', 'Tare weight', null, null::jsonb, null),
  ('binder-solution', 'solventAdded', 'Solvent added', null, null::jsonb, null),
  ('coating-suspension', 'solventAdded', 'Solvent added', null, null::jsonb, null),
  ('dry-mix', 'speed', 'Speed', 'speedLimit', null::jsonb, 'each'),
  ('mix', 'speed', 'Speed', 'speedLimit', null::jsonb, 'each'),
  ('granulate', 'endPoint', 'End-point reading', 'endPointLimit', null::jsonb, 'each'),
  ('roller-compact', 'rollForce', 'Roll force', 'forceLimit', null::jsonb, 'each'),
  ('roller-compact', 'rollGap', 'Roll gap', 'gapLimit', null::jsonb, 'each'),
  ('roller-compact', 'rollSpeed', 'Roll speed', 'rollSpeedLimit', null::jsonb, 'each'),
  ('roller-compact', 'feedSpeed', 'Feed screw speed', 'feedSpeedLimit', null::jsonb, 'each'),
  ('roller-compact', 'millSpeed', 'Mill speed', null, null::jsonb, null),
  ('roller-compact', 'ribbonThickness', 'Thickness of 3 ribbon pieces', 'thicknessLimit', null::jsonb, 'mean'),
  ('roller-compact', 'ribbonDensity', 'Ribbon density', 'densityLimit', null::jsonb, 'each'),
  ('roller-compact', 'fines', 'Fines of the milled granules', 'finesLimit', null::jsonb, 'each'),
  ('dry', 'inletTemp', 'Inlet temperature', null, null::jsonb, null),
  ('dry', 'lod', 'Loss on drying', 'lodLimit', null::jsonb, 'each'),
  ('dry-constant', 'weight', 'Sample weight', null, null::jsonb, null),
  ('lubricate', 'gross', 'Gross weight', null, null::jsonb, null),
  ('lubricate', 'tare', 'Tare weight', null, null::jsonb, null),
  ('sub-batch-combine', 'sub1', 'Sub-batch 1', null, null::jsonb, null),
  ('sub-batch-combine', 'sub2', 'Sub-batch 2', null, null::jsonb, null),
  ('sub-batch-combine', 'sub3', 'Sub-batch 3', null, null::jsonb, null),
  ('sub-batch-combine', 'sub4', 'Sub-batch 4', null, null::jsonb, null),
  ('sub-batch-combine', 'sub5', 'Sub-batch 5', null, null::jsonb, null),
  ('sub-batch-combine', 'sub6', 'Sub-batch 6', null, null::jsonb, null),
  ('sub-batch-combine', 'sub7', 'Sub-batch 7', null, null::jsonb, null),
  ('sub-batch-combine', 'sub8', 'Sub-batch 8', null, null::jsonb, null),
  ('sub-batch-combine', 'sub9', 'Sub-batch 9', null, null::jsonb, null),
  ('sub-batch-combine', 'sub10', 'Sub-batch 10', null, null::jsonb, null),
  ('sub-batch-combine', 'output', 'Combined weight', null, null::jsonb, null),
  ('blend-uniformity', 'results', 'Content at 10 locations (% of label claim)', 'meanLimit', null::jsonb, 'mean'),
  ('density-flow', 'sampleWeight', 'Sample weight', null, null::jsonb, null),
  ('density-flow', 'bulkVolume', 'Bulk volume', null, null::jsonb, null),
  ('density-flow', 'tappedVolume', 'Tapped volume', null, null::jsonb, null),
  ('density-flow', 'coneHeight', 'Cone height', null, null::jsonb, null),
  ('density-flow', 'coneRadius', 'Cone radius', null, null::jsonb, null),
  ('sieve-analysis', 'sample', 'Sample weight', null, null::jsonb, null),
  ('sieve-analysis', 'retained1', 'Retained on sieve 1', null, null::jsonb, null),
  ('sieve-analysis', 'retained2', 'Retained on sieve 2', null, null::jsonb, null),
  ('sieve-analysis', 'retained3', 'Retained on sieve 3', null, null::jsonb, null),
  ('sieve-analysis', 'retained4', 'Retained on sieve 4', null, null::jsonb, null),
  ('sieve-analysis', 'retained5', 'Retained on sieve 5', null, null::jsonb, null),
  ('sieve-analysis', 'pan', 'In the pan', null, null::jsonb, null),
  ('gel-mass', 'temperature', 'Gel mass temperature', 'tempLimit', null::jsonb, 'each'),
  ('gel-mass', 'viscosity', 'Viscosity', 'viscosityLimit', null::jsonb, 'each'),
  ('gel-mass', 'water', 'Water content', 'waterLimit', null::jsonb, 'each'),
  ('gel-mass', 'output', 'Net weight of gel mass made', null, null::jsonb, null),
  ('capsule-fill', 'weights', 'Weights of 20 filled capsules', 'meanLimit', null::jsonb, 'mean'),
  ('capsule-fill', 'length', 'Closed length of 5 capsules', null, null::jsonb, null),
  ('capsule-fill', 'rejected', 'Capsules rejected since the last round', null, null::jsonb, null),
  ('capsule-fill-net', 'c1', 'Capsule 1: full, then empty shell', null, null::jsonb, null),
  ('capsule-fill-net', 'c2', 'Capsule 2: full, then empty shell', null, null::jsonb, null),
  ('capsule-fill-net', 'c3', 'Capsule 3: full, then empty shell', null, null::jsonb, null),
  ('capsule-fill-net', 'c4', 'Capsule 4: full, then empty shell', null, null::jsonb, null),
  ('capsule-fill-net', 'c5', 'Capsule 5: full, then empty shell', null, null::jsonb, null),
  ('capsule-fill-net', 'c6', 'Capsule 6: full, then empty shell', null, null::jsonb, null),
  ('capsule-fill-net', 'c7', 'Capsule 7: full, then empty shell', null, null::jsonb, null),
  ('capsule-fill-net', 'c8', 'Capsule 8: full, then empty shell', null, null::jsonb, null),
  ('capsule-fill-net', 'c9', 'Capsule 9: full, then empty shell', null, null::jsonb, null),
  ('capsule-fill-net', 'c10', 'Capsule 10: full, then empty shell', null, null::jsonb, null),
  ('capsule-fill-net', 'rejected', 'Capsules rejected since the last round', null, null::jsonb, null),
  ('softgel-encapsulate', 'ribbonLeft', 'Ribbon thickness, left', 'ribbonLimit', null::jsonb, 'each'),
  ('softgel-encapsulate', 'ribbonRight', 'Ribbon thickness, right', 'ribbonLimit', null::jsonb, 'each'),
  ('softgel-encapsulate', 'wedgeTemp', 'Wedge temperature', 'wedgeLimit', null::jsonb, 'each'),
  ('softgel-encapsulate', 'c1', 'Capsule 1: whole, then washed shell', null, null::jsonb, null),
  ('softgel-encapsulate', 'c2', 'Capsule 2: whole, then washed shell', null, null::jsonb, null),
  ('softgel-encapsulate', 'c3', 'Capsule 3: whole, then washed shell', null, null::jsonb, null),
  ('softgel-encapsulate', 'c4', 'Capsule 4: whole, then washed shell', null, null::jsonb, null),
  ('softgel-encapsulate', 'c5', 'Capsule 5: whole, then washed shell', null, null::jsonb, null),
  ('softgel-encapsulate', 'c6', 'Capsule 6: whole, then washed shell', null, null::jsonb, null),
  ('softgel-encapsulate', 'c7', 'Capsule 7: whole, then washed shell', null, null::jsonb, null),
  ('softgel-encapsulate', 'c8', 'Capsule 8: whole, then washed shell', null, null::jsonb, null),
  ('softgel-encapsulate', 'c9', 'Capsule 9: whole, then washed shell', null, null::jsonb, null),
  ('softgel-encapsulate', 'c10', 'Capsule 10: whole, then washed shell', null, null::jsonb, null),
  ('softgel-encapsulate', 'seal', 'Seal thickness', 'sealLimit', null::jsonb, 'each'),
  ('softgel-encapsulate', 'rejected', 'Capsules rejected since the last round', null, null::jsonb, null),
  ('softgel-dry', 'temperature', 'Temperature', 'tempLimit', null::jsonb, 'each'),
  ('softgel-dry', 'rh', 'Relative humidity', 'rhLimit', null::jsonb, 'each'),
  ('softgel-dry', 'hardness', 'Hardness of 5 capsules', null, null::jsonb, null),
  ('softgel-dry-water', 'temperature', 'Temperature', 'tempLimit', null::jsonb, 'each'),
  ('softgel-dry-water', 'rh', 'Relative humidity', 'rhLimit', null::jsonb, 'each'),
  ('softgel-dry-water', 'water', 'Shell water content', 'waterLimit', null::jsonb, 'each'),
  ('dry-observe', 'temperature', 'Temperature', 'tempLimit', null::jsonb, 'each'),
  ('capsule-band', 'bandTemp', 'Band solution temperature', 'tempLimit', null::jsonb, 'each'),
  ('capsule-band', 'leakers', 'Leaking capsules found', null, '{"high":"0","unit":"capsules"}'::jsonb, 'each'),
  ('disintegration', 'temperature', 'Medium temperature', 'temperatureLimit', null::jsonb, 'each'),
  ('disintegration', 'times', 'Times of 6 capsules', null, null::jsonb, null),
  ('disintegration', 'moreTimes', 'Times of 12 more capsules', null, null::jsonb, null),
  ('uniformity-by-weight', 'c1', 'Capsule 1: full, then shell', null, null::jsonb, null),
  ('uniformity-by-weight', 'c2', 'Capsule 2: full, then shell', null, null::jsonb, null),
  ('uniformity-by-weight', 'c3', 'Capsule 3: full, then shell', null, null::jsonb, null),
  ('uniformity-by-weight', 'c4', 'Capsule 4: full, then shell', null, null::jsonb, null),
  ('uniformity-by-weight', 'c5', 'Capsule 5: full, then shell', null, null::jsonb, null),
  ('uniformity-by-weight', 'c6', 'Capsule 6: full, then shell', null, null::jsonb, null),
  ('uniformity-by-weight', 'c7', 'Capsule 7: full, then shell', null, null::jsonb, null),
  ('uniformity-by-weight', 'c8', 'Capsule 8: full, then shell', null, null::jsonb, null),
  ('uniformity-by-weight', 'c9', 'Capsule 9: full, then shell', null, null::jsonb, null),
  ('uniformity-by-weight', 'c10', 'Capsule 10: full, then shell', null, null::jsonb, null),
  ('uniformity-by-weight', 'assay', 'Assay (% of label claim, QC report)', null, null::jsonb, null),
  ('content-uniformity', 'results', 'Content of 10 capsules (% of label claim)', null, null::jsonb, null),
  ('content-uniformity', 'moreResults', 'Content of 20 more capsules (% of label claim)', null, null::jsonb, null),
  ('spray-coat', 'inletTemp', 'Inlet temperature', 'inletLimit', null::jsonb, 'each'),
  ('spray-coat', 'bedTemp', 'Product temperature', 'bedLimit', null::jsonb, 'each'),
  ('spray-coat', 'sprayRate', 'Spray rate', 'sprayRateLimit', null::jsonb, 'each'),
  ('spray-coat', 'airPressure', 'Atomising air pressure', null, null::jsonb, null),
  ('spray-coat', 'speed', 'Pan speed', null, null::jsonb, null),
  ('spray-coat', 'meanWeight', 'Mean weight of coated capsules', null, null::jsonb, null),
  ('polish-print', 'rejected', 'Capsules rejected', null, null::jsonb, null),
  ('checkweigh', 'setLow', 'Low set limit', 'weightLimit', null::jsonb, 'each'),
  ('checkweigh', 'setHigh', 'High set limit', 'weightLimit', null::jsonb, 'each'),
  ('checkweigh', 'rejected', 'Capsules rejected since the last check', null, null::jsonb, null),
  ('metal-check', 'rejected', 'Capsules rejected by the detector since the last check', null, null::jsonb, null),
  ('check', 'reading', 'Reading', 'limit', null::jsonb, 'each'),
  ('qa-sample', 'taken', 'Capsules taken', 'sampleLimit', null::jsonb, 'each'),
  ('stage-yield', 'output', 'Output', null, null::jsonb, null),
  ('stage-yield', 'samples', 'Samples', null, null::jsonb, null),
  ('stage-yield', 'rejects', 'Rejects', null, null::jsonb, null),
  ('capsule-reconciliation', 'output', 'Net weight of good capsules', null, null::jsonb, null),
  ('capsule-reconciliation', 'rejectWeight', 'Net weight of rejected capsules', null, null::jsonb, null),
  ('capsule-reconciliation', 'samples', 'Capsules taken as samples', null, null::jsonb, null);

do $$
declare
  rep text := case when current_schema() = 'public' then 'report' else current_schema() || '_report' end;
begin
  perform set_config('search_path', format('%I, %I', rep, current_schema()), true);
end $$;

create or replace view reading_v1 with (security_barrier) as
select b.batch_no || '/' || concat_ws('.', c.stage, c.sub, c.step, c.round) || '/' || c.field || '/' || r.n as reading_id,
  b.batch_no as batch_number, v.doc->'header'->>'productCode' as product_code,
  v.doc->'stages'->c.stage->>'name' as stage, (v.doc->'stages'->c.stage->>'key') || '/' || (st.step->>'key') as step,
  coalesce(d.place, (v.doc->'stages'->c.stage->>'name') || ' › ' || (st.step->>'key')) as step_name, c.sub as sub_batch, c.round,
  p.block, case when p.block = 'check' and st.step->'settings'->>'what' <> '' then st.step->'settings'->>'what' else p.label end as parameter,
  p.field, r.n::int as reading_no, (r.x->>'value')::numeric as value, r.x->>'unit' as unit,
  case when coalesce(lim.l, p.fixed_limit)->>'low' ~ '^-?[0-9]+(\.[0-9]+)?$' then (coalesce(lim.l, p.fixed_limit)->>'low')::numeric end as low_limit,
  case when coalesce(lim.l, p.fixed_limit)->>'high' ~ '^-?[0-9]+(\.[0-9]+)?$' then (coalesce(lim.l, p.fixed_limit)->>'high')::numeric end as high_limit,
  coalesce(lim.l, p.fixed_limit)->>'unit' as limit_unit, case when coalesce(lim.l, p.fixed_limit) is null then null else p.limit_of end as limit_of,
  c.at as recorded_at, c.kind = 'corrected' as corrected, now() as read_at, c.at as data_as_of
from (
  -- The current value of each field of each round of a step: the last value or correction that recorded it.
  select distinct on (x.batch_id, x.stage, x.sub, x.step, x.round, f.key) x.batch_id, x.stage, x.sub, x.step, x.round, f.key as field, f.value, x.kind, x.at
  from step_events x cross join jsonb_each(x.payload->'values') f
  where x.kind in ('value', 'corrected') and jsonb_typeof(x.payload->'values') = 'object'
  order by x.batch_id, x.stage, x.sub, x.step, x.round, f.key, x.id desc
) c
join batches b on b.id = c.batch_id
join master_versions v on v.id = b.master_version_id
cross join lateral (select v.doc->'stages'->c.stage->'steps'->c.step as step) st
join reading_parameters p on p.block = st.step->'block'->>'id' and p.field = c.field
-- Signed done (this round), with the step's place in words as kept with its start.
cross join lateral (
  select bool_or(e.kind = 'done') as done, (array_agg(e.payload->>'where' order by e.id) filter (where e.kind = 'started'))[1] as place
  from step_events e where e.batch_id = c.batch_id and e.stage = c.stage and e.sub = c.sub and e.step = c.step and e.round = c.round
) d
-- One reading, or each reading of a list in order.
cross join lateral (
  select c.value as x, 1::bigint as n where jsonb_typeof(c.value) = 'object'
  union all
  select a.x, a.n from jsonb_array_elements(case when jsonb_typeof(c.value) = 'array' then c.value else '[]' end) with ordinality a(x, n)
) r
-- The master step's limit, when it is a written one (low and/or high with a unit; not an earlier step's result).
left join lateral (
  select st.step->'settings'->p.limit_setting as l
  where p.limit_setting is not null and jsonb_typeof(st.step->'settings'->p.limit_setting) = 'object' and st.step->'settings'->p.limit_setting ? 'unit'
) lim on true
where d.done and jsonb_typeof(r.x) = 'object' and r.x->>'value' ~ '^-?[0-9]+(\.[0-9]+)?$';

revoke all on reading_v1 from public;
comment on view reading_v1 is 'One row per recorded number of a step signed done (process parameters and in-process checks), with the master''s limits; for continued process verification (Operations).';
comment on column reading_v1.limit_of is 'each: the limit applies to each reading; mean: to the mean of the list (T7). Null without a limit.';

reset search_path;
