-- batch_fact_v1 (18 Nov 2026, found on the demo: the first released capsule batch gave no good quantity and no yield):
-- the output comes from the batch's capsule reconciliation (block capsule-reconciliation, calculation goodCapsules);
-- 0015 and 0017 still read the Tablets names (tablet-reconciliation, goodTablets) left from the copy. Every column as
-- 0017 (create or replace keeps the grants the platform's set_link gave).

do $$
declare
  rep text := case when current_schema() = 'public' then 'report' else current_schema() || '_report' end;
begin
  perform set_config('search_path', format('%I, %I', rep, current_schema()), true);
end $$;

create or replace view batch_fact_v1 with (security_barrier) as
select md5('truebatch_capsules:batch:' || b.id)::uuid as batch_id, b.batch_no as batch_number, v.doc->'header'->>'productCode' as product_code,
  null::text as strength, md5('truebatch_capsules:master_version:' || v.id)::uuid as mbr_version_id, v.version_no::text as family_code,
  'PROCESSING'::text as record_kind,
  case when e.released then 'RELEASED' when e.rejected then 'REJECTED' when e.qc then 'QC_APPROVED'
       when e.produced is not null then 'PRODUCTION_APPROVED' else 'IN_PRODUCTION' end as status,
  b.issued_at, e.produced as completed_at, coalesce(e.released, false) as released,
  now() as read_at, greatest(b.issued_at, s.last, e.last) as data_as_of,
  (s.started at time zone 'Asia/Kolkata')::date as manufactured_on,
  v.doc->'header'->>'productName' as product_name, v.version_no as master_version,
  round(nullif(y.r->'goodCapsules'->>'value', '')::numeric, 0) as good_quantity, 'capsules'::text as good_unit,
  round(nullif(y.r->'yield'->>'value', '')::numeric, 2) as yield_percent,
  rl.at as released_at, rl.by as released_by
from batches b
join master_versions v on v.id = b.master_version_id
left join lateral (
  select bool_or(x.kind = 'released') as released, bool_or(x.kind = 'rejected') as rejected, bool_or(x.kind = 'qc_approved') as qc,
    min(x.at) filter (where x.kind = 'production_approved') as produced, max(x.at) as last
  from batch_events x where x.batch_id = b.id
) e on true
left join lateral (
  select max(x.at) as last, min(x.at) filter (where x.kind = 'started') as started from step_events x where x.batch_id = b.id
) s on true
-- QA's release: the time of the 'released' batch event and the name its e-signature printed (null until released).
left join lateral (
  select x.at, (select g.printed_name from signatures g where g.object_type = 'batch_event' and g.object_id = x.id and g.meaning = 'released') as by
  from batch_events x where x.batch_id = b.id and x.kind = 'released' order by x.id limit 1
) rl on true
-- The batch's capsule reconciliation (the last such step of the master): its results as last recorded, once the step
-- is done (signed, and not sent back since); null before.
left join lateral (
  select (st.i - 1)::int as stage, (sp.j - 1)::int as step
  from jsonb_array_elements(v.doc->'stages') with ordinality st(x, i), jsonb_array_elements(st.x->'steps') with ordinality sp(y, j)
  where sp.y->'block'->>'id' = 'capsule-reconciliation' order by st.i desc, sp.j desc limit 1
) tr on true
left join lateral (
  select jsonb_object_agg(k, val) filter (where (val->>'ok')::boolean) as r from (
    select distinct on (x.key) x.key as k, x.value as val
    from step_events y cross join lateral jsonb_each(y.payload->'results') x
    where y.batch_id = b.id and y.stage = tr.stage and y.step = tr.step and y.payload ? 'results'
      and (select z.kind from step_events z where z.batch_id = b.id and z.stage = tr.stage and z.step = tr.step
             and z.kind in ('done', 'sent_back') order by z.id desc limit 1) = 'done'
    order by x.key, y.id desc) q
) y on true;

reset search_path;
