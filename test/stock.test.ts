import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, type Sql } from '../server/db.js';
import { links } from '../server/links.js';
import { PACKING } from '../packing/product.js';
import { PACKING_APP_ROLE } from '../packing/migrate.js';
import { bulkIssueProblem, bulkLeft, inLotUnit, issuedLots, materialUses, returnProblems, unitName, type StepView } from '../shared/engine/index.js';
import { call, freshApp, handLabels, login, proofFor, seedUser, TEST_DATABASE_URL, type TestApp } from './helpers.js';
import { pack, packing } from './packing-fixture.js';

// A packing material lot is not issued beyond what MMS shows available (owner, 16 Nov 2026): MMS's balance of the lot
// (lot_v1.stock, a fake provider schema read with packing's restricted login) less what packing already used from it
// (its material_use_v1). MMS down, or an MMS whose lot_v1 gives no stock: nothing is compared, as before.

let t: TestApp;
let provider: Sql;
let MMS = '';
const cookies: Record<string, string> = {};
const item = (itemId: string, c: string, name: string) => ({ itemId, code: c, name, version: 1, active: true });
const P = (...codes: string[]) => codes.map((c) => `truebatch_capsules_packing.${c}` as const);

beforeAll(async () => {
  t = await freshApp(async (db) => {
    MMS = `${db.schema}_mms`;
    await db.owner.unsafe(`
      create schema ${MMS};
      create table ${MMS}.lot_v1 (lot_number text, kind text, material_master_id text, material_code text, product_master_id text, product_code text, status text,
        expiry_date date, retest_date date, qc_report_ref text, read_at timestamptz default now(), data_as_of timestamptz default now(), stock numeric, unit text, stock_after_use numeric);
      create table ${MMS}.lot_test_v1 (lot_number text, report_ref text, test text, value numeric, unit text, basis text, read_at timestamptz default now(), data_as_of timestamptz default now());
      insert into ${MMS}.lot_v1 (lot_number, kind, material_master_id, material_code, status, expiry_date, qc_report_ref, stock, unit) values
        ('CTN-1', 'material', 'pm-ctn', 'PM-103', 'approved', '2099-01-31', 'QC-26-201', 1000, 'nos'),
        ('CTN-OLD', 'material', 'pm-ctn', 'PM-103', 'approved', '2099-01-31', 'QC-26-202', null, null);
      insert into ${MMS}.lot_v1 (lot_number, kind, material_master_id, material_code, status, expiry_date, qc_report_ref, stock, unit, stock_after_use) values
        ('CTN-2', 'material', 'pm-ctn', 'PM-103', 'approved', '2099-01-31', 'QC-26-203', 1000, 'nos', 300);
      grant usage on schema ${MMS} to ${PACKING_APP_ROLE};
      grant select on all tables in schema ${MMS} to ${PACKING_APP_ROLE};`);
    provider = connect(TEST_DATABASE_URL, { role: PACKING_APP_ROLE, link: true });
    return links({ mms: provider }, { mms: MMS });
  }, PACKING);
  t.master.products_.push({ ...item('pk-1', 'PK-001', 'Examplol 100 mg capsules, 10 x 10 blister'), strength: '100 mg', dosageForm: 'capsule' },
    { ...item('prd-1', 'PRD-001', 'Examplol 100 mg capsules'), strength: '100 mg', dosageForm: 'capsule' });
  for (const m of packing().pack!.materials) t.master.materials_.push({ ...item(m.materialItemId, m.code, m.name), category: 'packing', unit: m.unit === 'units' ? 'nos' : m.unit });
  t.master.equipment_.push({ ...item('ln-1', 'BL-01', 'Blister line 1'), kind: 'equipment', type: 'blister line', room: 'PK-01' },
    { ...item('ln-2', 'BL-02', 'Blister line 2'), kind: 'equipment', type: 'blister line', room: 'PK-02' });
  for (const [name, perms] of Object.entries({ author: P('master.author'), issuer: P('batch.issue'), op1: P('batch.operate'), chk1: P('batch.check'), qa1: P('qa.release') })) {
    await seedUser(t.owner, name, perms);
    cookies[name] = (await login(t.app, name)).cookie;
  }
});
afterAll(async () => {
  await provider?.end();
  await t.owner.unsafe(`drop schema if exists ${MMS} cascade`);
  await t.close();
});

const as = (who: string, method: 'GET' | 'POST', url: string, body?: object) => call(t.app, cookies[who]!, method, url, body);
type Detail = { steps: { id: string; actions: string[]; contentHash: string }[] };
const hash = async (id: number, key: string) => ((await as('op1', 'GET', `/api/batches/${id}`)).json() as Detail).steps.find((s) => s.id === key)!.contentHash;
// A packing batch on its own line, the bulk typed from its labels (no TrueBatch Capsules link here), its bulk received.
async function batch(line: string) {
  const res = await as('author', 'POST', '/api/masters', { doc: master() });
  const mv = (res.json() as { id: number }).id;
  for (const s of ['in_review', 'approved', 'effective']) await t.owner`update master_versions set state = ${s} where id = ${mv}`;
  const b = await as('issuer', 'POST', '/api/batches', { masterVersionId: mv, proof: proofFor('issuer'),
    values: { line, ...handLabels('line', 'machine'), bulk: 'TB260001', capsules: '100000', mfgDate: '2026-11-03', 'bulk.released': 'yes', 'bulk.product': 'yes' } });
  expect(b.statusCode, b.body).toBe(200);
  const id = (b.json() as { id: number }).id;
  expect((await as('op1', 'POST', `/api/batches/${id}/steps/0.1.0.1/record`, { values: { received: 'yes' } })).statusCode).toBe(200);
  expect((await as('op1', 'POST', `/api/batches/${id}/steps/0.1.0.1/done`, { proof: proofFor('op1'), contentHash: await hash(id, '0.1.0.1') })).statusCode).toBe(200);
  const c = await as('chk1', 'POST', `/api/batches/${id}/steps/0.1.0.1/check`, { proof: proofFor('chk1'), contentHash: await hash(id, '0.1.0.1') });
  expect(c.statusCode, c.body).toBe(200);
  return id;
}
// The pack with its cartons issued first (the issue steps run in order): the carton issue step is 0.1.1.1.
const master = () => { const m = pack().materials; return packing({ materials: [m[2]!, ...m.filter((x) => x.key !== 'carton')] }); };
const CARTON = '0.1.1.1';
const record = (id: number, values: object) => as('op1', 'POST', `/api/batches/${id}/steps/${CARTON}/record`, { values });

describe('a packing material lot is not issued beyond what MMS shows available', () => {
  let first = 0;
  let second = 0;
  beforeAll(async () => {
    first = await batch('ln-1');
    second = await batch('ln-2');
    for (const id of [first, second]) { const r = await as('op1', 'POST', `/api/batches/${id}/steps/${CARTON}/start`); expect(r.statusCode, r.body).toBe(200); }
  });

  it('TC-P4 a quantity within MMS\'s stock is issued; one above it is refused, with what MMS has and what is already used', async () => {
    const over = await record(first, { lot: 'CTN-1', issued: '1200', matches: 'yes' });
    expect(over.statusCode).toBe(409);
    expect(over.json()).toMatchObject({ problems: ['Lot CTN-1 has 1000 nos available in MMS (1000 nos in stock less 0 nos already used in TrueBatch Capsules Packing): '
      + '1200 nos cannot be taken from it. Take at most 1000 nos, or another lot.'] });
    expect((await record(first, { lot: 'CTN-1', issued: '600', matches: 'yes' })).statusCode).toBe(200);
    const done = await as('op1', 'POST', `/api/batches/${first}/steps/${CARTON}/done`, { proof: proofFor('op1'), contentHash: await hash(first, CARTON) });
    expect(done.statusCode, done.body).toBe(200);
  });

  it('TC-P4 what packing already used of the lot is taken off; a step\'s own quantity is not counted twice', async () => {
    expect((await record(second, { lot: 'CTN-1', issued: '500', matches: 'yes' })).json()).toMatchObject({ problems: [
      'Lot CTN-1 has 400 nos available in MMS (1000 nos in stock less 600 nos already used in TrueBatch Capsules Packing): 500 nos cannot be taken from it. Take at most 400 nos, or another lot.'] });
    expect((await record(second, { lot: 'CTN-1', issued: '400', matches: 'yes' })).statusCode).toBe(200);
    // Typing the quantity again counts it once: still within the stock.
    expect((await record(second, { issued: '400' })).statusCode).toBe(200);
    // Signing it done checks again: MMS's balance fell meanwhile (e.g. an issue in MMS).
    await t.owner.unsafe(`update ${MMS}.lot_v1 set stock = 900 where lot_number = 'CTN-1'`);
    const done = await as('op1', 'POST', `/api/batches/${second}/steps/${CARTON}/done`, { proof: proofFor('op1'), contentHash: await hash(second, CARTON) });
    expect(done.json()).toMatchObject({ error: 'not_in_stock', problems: [expect.stringMatching(/^Lot CTN-1 has 300 nos available in MMS .*Take at most 300 nos, or another lot\.$/)] });
    await t.owner.unsafe(`update ${MMS}.lot_v1 set stock = 1000 where lot_number = 'CTN-1'`);
  });

  it('TC-P4 MMS down, or an MMS whose lot_v1 gives no stock yet: nothing is compared, as before', async () => {
    // A lot without stock in MMS's view.
    expect((await record(second, { lot: 'CTN-OLD', issued: '5000', matches: 'yes' })).statusCode).toBe(200);
    await t.owner.unsafe(`revoke select on all tables in schema ${MMS} from ${PACKING_APP_ROLE}`);
    try {
      expect((await record(second, { lot: 'CTN-1', ...handLabels('lot', 'lot'), issued: '5000', matches: 'yes' })).statusCode).toBe(200);
    } finally {
      await t.owner.unsafe(`grant select on all tables in schema ${MMS} to ${PACKING_APP_ROLE}`);
    }
  });

  it('TC-21 what a terminated batch gave back to stores is available again (owner, 16 Nov 2026)', async () => {
    const b = (await as('qa1', 'GET', `/api/batches/${first}`)).json() as { batch: { contentHash: string; issued: object[] } };
    // The bulk capsules issued to it first (what went back of them can be issued again: bulkLeft), then its lots.
    expect(b.batch.issued).toEqual([{ lot: 'TB260001', material: 'bulk PRD-001 · Examplol 100 mg capsules', value: '100000', unit: 'capsules' },
      { lot: 'CTN-1', material: expect.stringMatching(/^PM-103 /), value: '600', unit: 'nos' }]);
    const r = await as('qa1', 'POST', `/api/batches/${first}/terminate`, { proof: proofFor('qa1'), contentHash: b.batch.contentHash, reason: 'Line down',
      returns: [{ lot: 'TB260001', value: '100000', unit: 'capsules' }, { lot: 'CTN-1', value: '200', unit: 'nos' }] });
    expect(r.statusCode, r.body).toBe(200);
    // 1000 in stock less 400 still used by the terminated batch: 600 available for the other one.
    expect((await record(second, { lot: 'CTN-1', issued: '601', matches: 'yes' })).json()).toMatchObject({ problems: [expect.stringMatching(/^Lot CTN-1 has 600 nos available in MMS \(1000 nos in stock less 400 nos already used/)] });
    expect((await record(second, { lot: 'CTN-1', issued: '600', matches: 'yes' })).statusCode).toBe(200);
  });

  it('a lot typed by hand while MMS was down, then an MMS lot picked: the step signs, the hand answers stay in the history (port of Tablets round 36)', async () => {
    // The step of the second batch: CTN-1 typed by hand with its label answers (MMS down), now CTN-OLD from MMS.
    expect((await record(second, { lot: 'CTN-OLD', issued: '600', matches: 'yes' })).statusCode).toBe(200);
    const d = await as('op1', 'POST', `/api/batches/${second}/steps/${CARTON}/done`, { proof: proofFor('op1'), contentHash: await hash(second, CARTON) });
    expect(d.statusCode, d.body).toBe(200);
    const h = await t.owner<{ n: number }[]>`select count(*)::int as n from step_events where batch_id = ${second} and kind = 'value'
      and payload->'values' ?| array['lot.released', 'lot.expiry', 'lot.report']`;
    expect(h[0]!.n).toBeGreaterThan(0);
  });

  it('what the other TrueBatch products used counts too: MMS\'s stock after use (port of Tablets round 35)', async () => {
    const third = await batch('ln-1');
    expect((await as('op1', 'POST', `/api/batches/${third}/steps/${CARTON}/start`)).statusCode).toBe(200);
    // 1000 in stock, 700 used by another product: 300 left, which this app's own uses (none) would not show.
    expect((await record(third, { lot: 'CTN-2', issued: '400', matches: 'yes' })).json()).toMatchObject({ problems: [
      'Lot CTN-2 has 300 nos available in MMS (after use in all TrueBatch products): 400 nos cannot be taken from it. Take at most 300 nos, or another lot.'] });
    expect((await record(third, { lot: 'CTN-2', issued: '300', matches: 'yes' })).statusCode).toBe(200);
    // MMS's figure above this app's own (not refreshed yet): the lower one, this app's, holds.
    await t.owner.unsafe(`update ${MMS}.lot_v1 set stock = 900, stock_after_use = 1000 where lot_number = 'CTN-2'`);
    expect((await record(third, { issued: '901' })).json()).toMatchObject({ problems: [expect.stringMatching(/^Lot CTN-2 has 900 nos available in MMS \(900 nos in stock less 0 nos already used/)] });
    await t.owner.unsafe(`update ${MMS}.lot_v1 set stock = 1000 where lot_number = 'CTN-2'`);
    // Signed and checked at 300; MMS refreshed with those 300 taken off: a correction does not count them twice.
    await t.owner.unsafe(`update ${MMS}.lot_v1 set stock_after_use = 300 where lot_number = 'CTN-2'`);
    const sd = await as('op1', 'POST', `/api/batches/${third}/steps/${CARTON}/done`, { proof: proofFor('op1'), contentHash: await hash(third, CARTON) });
    expect(sd.statusCode, sd.body).toBe(200);
    expect((await as('chk1', 'POST', `/api/batches/${third}/steps/${CARTON}/check`, { proof: proofFor('chk1'), contentHash: await hash(third, CARTON) })).statusCode).toBe(200);
    await t.owner.unsafe(`update ${MMS}.lot_v1 set stock_after_use = 0 where lot_number = 'CTN-2'`);
    const correct = (n: string) => as('op1', 'POST', `/api/batches/${third}/steps/${CARTON}/correct`, { values: { issued: n }, reason: 'Recounted' });
    expect((await correct('300')).statusCode).toBe(200);
    expect((await correct('301')).json()).toMatchObject({ problems: [expect.stringMatching(/^Lot CTN-2 has 300 nos available in MMS \(after use in all TrueBatch products\)/)] });
  });

  it('a quantity is counted in the lot\'s unit as MMS counts it: the same kind by a power of ten, never across kinds', () => {
    expect(inLotUnit({ value: '600.5', unit: 'g' }, 'kg')?.toString()).toBe('0.6005');
    expect(inLotUnit({ value: '12', unit: 'units' }, 'Nos')?.toString()).toBe('12');
    expect(inLotUnit({ value: '1.5', unit: 'L' }, 'mL')?.toString()).toBe('1500');
    expect(inLotUnit({ value: '12', unit: 'm' }, 'kg')).toBeNull();
    expect(inLotUnit({ value: '12', unit: 'g' }, 'nos')).toBeNull();
  });

  it('a terminated batch\'s returns are taken off its uses of the same lot and unit, the last step first, never below 0 (as material_use_v1)', () => {
    const doc = packing();
    const at = (kind: string) => doc.stages.flatMap((st, stage) => st.steps.map((t, step) => ({ t, stage, step })))
      .find((x) => x.t.block.id === 'pack-material-issue' && (x.t.settings.material as { formula: string }).formula === kind)!;
    const use = (kind: string, lot: string, value: string, unit: string, stockUnit?: string) => {
      const { stage, step } = at(kind);
      return { key: { stage, sub: 1, step, round: 1 }, id: `${stage}.1.${step}.1`, values: { lot, issued: { value, unit } }, results: {},
        events: [{ kind: 'done', payload: stockUnit ? { stockUnit } : {} }] } as unknown as StepView;
    };
    const steps = [use('foil', 'L-1', '100', 'm'), use('pvc', 'l-1', '50', 'm'), use('carton', 'C-1', '105', 'units', 'nos')];
    // What QA is asked about: per lot and unit as published (a count in master data's name for it).
    expect(issuedLots(doc, steps)).toEqual([{ lot: 'L-1', material: expect.stringMatching(/^PM-101 /), value: '150', unit: 'm' }, { lot: 'C-1', material: expect.stringMatching(/^PM-103 /), value: '105', unit: 'nos' }]);
    const net = (returns: { lot: string; value: string; unit: string }[]) => materialUses(doc, steps, returns.map((r) => ({ ...r, material: '' }))).map((u) => `${u.lot} ${u.quantity.value} ${u.quantity.unit}`);
    expect(net([{ lot: 'L-1', value: '80', unit: 'm' }, { lot: 'C-1', value: '5', unit: 'nos' }])).toEqual(['L-1 70 m', 'l-1 0 m', 'C-1 100 nos']);
    expect(net([{ lot: 'L-1', value: '150', unit: 'm' }, { lot: 'C-1', value: '5', unit: 'units' }])).toEqual(['L-1 0 m', 'l-1 0 m', 'C-1 105 nos']);
    // Validated: one answer per lot, 0 up to what the batch used of it.
    const issued = issuedLots(doc, steps);
    expect(returnProblems(issued, [{ lot: 'L-1', value: '0', unit: 'm' }, { lot: 'C-1', value: '105', unit: 'nos' }])).toEqual([]);
    expect(returnProblems(issued, [{ lot: 'L-1', value: '151', unit: 'm' }, { lot: 'X-9', value: '1', unit: 'm' }])).toEqual(['Lot X-9 (m) was not issued to this batch.',
      'Lot L-1: 150 m was issued to this batch; 151 m cannot have gone back to stores.', expect.stringMatching(/^Say how much of lot C-1 \(PM-103 · .*\) went back to stores unused: 0 if none\.$/)]);
    expect(returnProblems([], [])).toEqual([]);
  });

  it('packing (bug fix, 17 Nov 2026): what is left of a bulk batch is its good capsules less the other packing batches\' issues, net of what a terminated one gave back; a part issue up to it', () => {
    const others = [{ batchNo: 'TP260001', capsules: '30000', returned: null }, { batchNo: 'TP260002', capsules: '10000', returned: '4000' }, { batchNo: 'TP260003', capsules: '5000', returned: '5000' }];
    const left = bulkLeft('48000', others);
    expect(left).toEqual({ issued: '36000', left: '12000' });
    expect(bulkLeft('48000', [])).toEqual({ issued: '0', left: '48000' });
    expect(bulkLeft('30000', others)).toEqual({ issued: '36000', left: '0' });
    expect(bulkIssueProblem('TB260001', null, '48000', left)).toBeNull();
    expect(bulkIssueProblem('TB260001', '12000', '48000', left)).toBeNull();
    expect(bulkIssueProblem('TB260001', '5000', '48000', left)).toBeNull();
    expect(bulkIssueProblem('TB260001', '12001', '48000', left)).toBe('Only 12000 capsules of bulk batch TB260001 are left to issue (48000 good capsules, 36000 already issued to other packing batches): issue 12000 or less.');
    expect(bulkIssueProblem('TB260001', '0', '48000', left)).toBe('Bulk capsules issued: give more than 0 capsules.');
    expect(bulkIssueProblem('TB260001', null, '30000', bulkLeft('30000', others))).toBe('All 30000 good capsules of bulk batch TB260001 are already issued to other packing batches: nothing is left to issue.');
  });

  it('a quantity field shows master data\'s name for the same unit (nos for units), never another unit', () => {
    expect(unitName('units', 'nos')).toBe('nos');
    expect(unitName('kg', 'kg')).toBe('kg');
    expect(unitName('g', 'kg')).toBe('g');
    expect(unitName('m', 'nos')).toBe('m');
    expect(unitName('units', null)).toBe('units');
  });
});
