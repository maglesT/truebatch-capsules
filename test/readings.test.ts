// Round 46: report.reading_v1, one row per recorded number of a step signed done, with the master's limits, for
// Operations' continued process verification (db/migrations/0023, shared/engine/readings.ts).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readingParameters } from '../shared/engine/readings.js';
import { freshDb, seedUser, type TestDb } from './helpers.js';
import { small } from './engine-fixture.js';
import { findBlock } from '../shared/blocks/index.js';

let t: TestDb;
let user = 0;
beforeAll(async () => {
  t = await freshDb();
  user = await seedUser(t.owner, 'reader.one', []);
});
afterAll(async () => t?.close());
const rep = () => `${t.schema}_report`;

const q = (value: string, unit: string) => ({ value, unit });
async function batch(no: string, steps: object[]) {
  const doc = small([{ key: 'compaction', name: 'Dry granulation', steps }]);
  const [v] = await t.owner<{ id: number }[]>`insert into master_versions (version_no, doc, created_by) values (1, ${t.owner.json(doc as never)}, ${user}) returning id::int`;
  const [b] = await t.owner<{ id: number }[]>`insert into batches (batch_no, master_version_id, issued_by) values (${no}, ${v!.id}, ${user}) returning id::int`;
  return (step: number, round: number, kind: string, payload: object, at: string) => t.owner`insert into step_events (batch_id, stage, sub, step, round, kind, payload, person_id, at)
    values (${b!.id}, 0, 1, ${step}, ${round}, ${kind}, ${t.owner.json(payload as never)}, ${user}, ${at})`;
}
const rows = (no: string) => t.owner.unsafe(`select reading_id, stage, step, step_name, sub_batch, round, block, parameter, field, reading_no, value::text, unit,
  low_limit::text, high_limit::text, limit_unit, limit_of, recorded_at, corrected from ${rep()}.reading_v1 where batch_number = $1 order by step, round, field, reading_no`, [no]);

describe('reading_v1', () => {
  it('the list of number fields in the database is the blocks\' (a new number field needs a migration replacing reading_parameters)', async () => {
    const db = await t.owner<{ block: string; field: string; label: string; limit_setting: string | null; fixed_limit: object | null; limit_of: string | null }[]>`
      select block, field, label, limit_setting, fixed_limit, limit_of from reading_parameters`;
    expect(db.map((r) => ({ block: r.block, field: r.field, label: r.label, limitSetting: r.limit_setting, fixedLimit: r.fixed_limit, limitOf: r.limit_of })))
      .toEqual(readingParameters());
    // The new block feeds it, with its limits.
    expect(readingParameters().filter((p) => p.block === 'roller-compact').map((p) => [p.field, p.limitSetting, p.limitOf])).toEqual([
      ['rollForce', 'forceLimit', 'each'], ['rollGap', 'gapLimit', 'each'], ['rollSpeed', 'rollSpeedLimit', 'each'], ['feedSpeed', 'feedSpeedLimit', 'each'],
      ['millSpeed', null, null], ['ribbonThickness', 'thicknessLimit', 'mean'], ['ribbonDensity', 'densityLimit', 'each'], ['fines', 'finesLimit', 'each']]);
    expect(readingParameters().find((p) => p.block === 'capsule-band' && p.field === 'leakers')).toMatchObject({ fixedLimit: { high: '0', unit: 'capsules' }, limitOf: 'each' });
    // Every number field of every capsule block is listed, never a packing block's.
    expect(readingParameters().some((p) => findBlock({ id: p.block, version: 1 })!.packing)).toBe(false);
  });

  it('one row per reading of a step signed done, with the master\'s limits; a list one row per reading; the current value after a correction', async () => {
    const roller = { key: 'compact', block: { id: 'roller-compact', version: 1 }, settings: { forceUnit: 'kN/cm', forceLimit: { low: '6', high: '10', unit: 'kN/cm' },
      gapLimit: { low: '2.0', high: '3.0', unit: 'mm' }, thicknessLimit: { low: '2.0', high: '3.2', unit: 'mm' }, finesLimit: { high: '30', unit: '%' } } };
    const e = await batch('READ-1', [roller, { key: 'check', settings: { what: 'pH of the binder', unit: '', limit: { low: '5.0', high: '7.0', unit: '' } } }]);
    await e(0, 1, 'started', { where: 'Dry granulation › Roller compaction with periodic checks' }, '2026-11-20 08:00+00');
    await e(0, 1, 'value', { values: { machine: { code: 'RC-01' }, rollForce: q('8.0', 'kN/cm'), rollGap: q('2.5', 'mm'), ribbonThickness: [q('2.4', 'mm'), q('2.6', 'mm'), q('2.5', 'mm')],
      fines: q('22.0', '%'), screenOk: 'yes', 'lot.expiry': '2027-01-01' } }, '2026-11-20 08:05+00');
    // Round 2 recorded, not signed: not published yet.
    await e(0, 2, 'started', {}, '2026-11-20 08:30+00');
    await e(0, 2, 'value', { values: { rollGap: q('2.6', 'mm') } }, '2026-11-20 08:31+00');
    // The "check a value" step: its parameter is what the master says it checks.
    await e(1, 1, 'started', {}, '2026-11-20 09:00+00');
    await e(1, 1, 'value', { values: { reading: q('6.1', '') } }, '2026-11-20 09:01+00');
    await e(1, 1, 'done', {}, '2026-11-20 09:02+00');
    expect((await rows('READ-1')).map((r) => r.field)).toEqual(['reading']);
    await e(0, 1, 'done', {}, '2026-11-20 08:06+00');
    const r = await rows('READ-1');
    expect(r.map((x) => [x.field, x.reading_no, x.value, x.unit, x.low_limit, x.high_limit, x.limit_unit, x.limit_of])).toEqual([
      ['reading', 1, '6.1', '', '5.0', '7.0', '', 'each'],
      ['fines', 1, '22.0', '%', null, '30', '%', 'each'],
      ['ribbonThickness', 1, '2.4', 'mm', '2.0', '3.2', 'mm', 'mean'],
      ['ribbonThickness', 2, '2.6', 'mm', '2.0', '3.2', 'mm', 'mean'],
      ['ribbonThickness', 3, '2.5', 'mm', '2.0', '3.2', 'mm', 'mean'],
      ['rollForce', 1, '8.0', 'kN/cm', '6', '10', 'kN/cm', 'each'],
      ['rollGap', 1, '2.5', 'mm', '2.0', '3.0', 'mm', 'each'],
    ]);
    expect(r[1]).toMatchObject({ reading_id: 'READ-1/0.1.0.1/fines/1', stage: 'Dry granulation', step: 'compaction/compact', step_name: 'Dry granulation › Roller compaction with periodic checks',
      sub_batch: 1, round: 1, block: 'roller-compact', parameter: 'Fines of the milled granules', recorded_at: new Date('2026-11-20T08:05:00Z'), corrected: false });
    expect(r[0]).toMatchObject({ parameter: 'pH of the binder', step_name: 'Dry granulation › check' });
    await e(0, 1, 'corrected', { values: { rollGap: q('2.4', 'mm') }, reason: 'Misread' }, '2026-11-20 10:00+00');
    expect((await rows('READ-1')).find((x) => x.field === 'rollGap')).toMatchObject({ value: '2.4', corrected: true, recorded_at: new Date('2026-11-20T10:00:00Z') });
  });

  it('is published in the report schema with its columns, closed to everybody until the platform links a reader', async () => {
    const cols = await t.owner.unsafe(`select column_name || ' ' || data_type as c from information_schema.columns where table_schema = $1 and table_name = 'reading_v1' order by ordinal_position`, [rep()]);
    expect(cols.map((c) => c.c)).toEqual(['reading_id text', 'batch_number text', 'product_code text', 'stage text', 'step text', 'step_name text', 'sub_batch integer', 'round integer',
      'block text', 'parameter text', 'field text', 'reading_no integer', 'value numeric', 'unit text', 'low_limit numeric', 'high_limit numeric', 'limit_unit text', 'limit_of text',
      'recorded_at timestamp with time zone', 'corrected boolean', 'read_at timestamp with time zone', 'data_as_of timestamp with time zone']);
    await expect(t.sql.unsafe(`select 1 from ${rep()}.reading_v1 limit 1`)).rejects.toThrow(/permission denied/);
  });

  it('PL-01 the report schema holds exactly the views the manifest publishes (reading_v1 among them); reading_parameters is not published', async () => {
    const m = JSON.parse(readFileSync(path.join(import.meta.dirname, '../ops/manifest.draft.json'), 'utf8')) as { publishes: string[] };
    const views = await t.owner.unsafe(`select table_name from information_schema.views where table_schema = $1 order by table_name`, [rep()]);
    expect(views.map((v) => v.table_name)).toEqual([...m.publishes].sort());
    expect(m.publishes).toContain('reading_v1');
  });
});
