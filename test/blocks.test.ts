import { describe, expect, it } from 'vitest';
import { findBlock } from '../shared/blocks/index.js';
import { blockProblems } from '../shared/blocks/format.js';
import { doneProblems, evaluate, openSteps, parseKey, type StepEvent, type Value } from '../shared/engine/index.js';
import { readValue } from '../shared/engine/values.js';
import { masterChecks } from '../shared/master/checks.js';
import type { MasterDoc } from '../shared/master/schema.js';
import { at, ev, small, unplaced } from './engine-fixture.js';
// The problems, without the rooms a stage must name (TC-11): the fixtures name none.
const checks = (d: Parameters<typeof masterChecks>[0]) => unplaced(masterChecks(d));

// The standard capsule blocks: each is a description that the format accepts and that a small master can use without
// a master-check problem; the engine runs them like any other block.

const pct = (low: string, high: string) => ({ low, high, unit: '%' });
const minutes = { low: '10', high: '12', unit: 'min' };
const yieldStep = { key: 'yield', block: { id: 'stage-yield', version: 1 }, checker: true, settings: { theoretical: '0.100 kg', yieldLimit: pct('97.0', '100.5') } };

// Each new block with the settings a small master gives it (and its step options).
const NEW: [string, Record<string, unknown>, object?][] = [
  ['sift', { sieve: '40 mesh (425 µm)' }],
  ['binder-solution', { binder: { formula: 'x' }, targetSolids: '10 %', tolerance: '1.0', mixTimeLimit: minutes }],
  ['coating-suspension', { powder: { formula: 'x' }, targetSolids: '12 %', tolerance: '1.0', mixTimeLimit: minutes }],
  ['dry-mix', { mixTimeLimit: minutes }],
  ['lubricate', { lubricant: { formula: 'x' }, granuleWeight: '0.098 kg', theoretical: '0.100 kg', window: pct('90.0', '102.0'), tolerance: '1.0', mixTimeLimit: minutes }],
  ['sub-batch-combine', { accountabilityLimit: pct('99.0', '100.5') }],
  ['blend-uniformity', { meanLimit: pct('90.0', '110.0'), rsdLimit: { high: '5.0', unit: '%' }, individualLimit: pct('85.0', '115.0') }],
  ['density-flow', { carrLimit: { high: '20', unit: '%' }, hausnerLimit: { high: '1.25', unit: '' }, reposeLimit: { high: '40', unit: '°' } }],
  ['sieve-analysis', { sieve1: '850 µm', sieve2: '425 µm', sieve3: '250 µm', sieve4: '180 µm', sieve5: '150 µm', finesBelow: '150 µm', finesLimit: { high: '20.0', unit: '%' } }],
  ['disintegration', { maxTime: '15', temperatureLimit: { low: '35', high: '39', unit: '°C' } }],
  ['uniformity-by-weight', { coating: 'hard capsule', labelClaim: '50 mg' }],
  ['content-uniformity', { coating: 'soft capsule, suspension fill' }],
  ['spray-coat', { coreWeight: { header: 'fillWeight' }, base: 'start', gainLimit: pct('2.8', '3.2'), inletLimit: { low: '50', high: '70', unit: '°C' }, bedLimit: { low: '38', high: '45', unit: '°C' } }, { everyMinutes: 15, flow: { kind: 'repeat-until', maxRounds: 20 } }],
  ['polish-print', { print: 'Logo in black' }],
  ['qa-sample', { sampleLimit: { low: '50', high: '60', unit: 'capsules' } }, { flow: { kind: 'qa-hold' } }],
  ['capsule-reconciliation', { theoretical: { header: 'batchSize' }, meanWeight: { header: 'filledWeight' }, yieldLimit: pct('97.0', '100.5'), accountabilityLimit: pct('99.0', '100.5') }],
  // The capsule blocks (capsules-plan.md 3) and their variants (owner, 18 Nov 2026). Gross limits on 100.0 + 75.0 mg.
  ['capsule-fill', { meanLimit: { low: '170.0', high: '180.0', unit: 'mg' }, weightBand: '7.5', weightOuterBand: '15.0', lengthLimit: { low: '19.0', high: '19.8', unit: 'mm' } }, { everyMinutes: 30, flow: { kind: 'repeat-until', maxRounds: 40 } }],
  ['capsule-fill-net', { fillTarget: { header: 'fillWeight' }, meanLimit: { low: '97.0', high: '103.0', unit: 'mg' }, weightBand: '7.5' }, { everyMinutes: 30, flow: { kind: 'repeat-until', maxRounds: 40 } }],
  ['capsule-band', { tempLimit: { low: '45', high: '55', unit: '°C' } }, { everyMinutes: 30, flow: { kind: 'repeat-until', maxRounds: 40 } }],
  ['metal-check', { feSize: '1.0', nonFeSize: '1.5', ssSize: '2.0' }, { everyMinutes: 60, flow: { kind: 'repeat-until', maxRounds: 40 } }],
  ['gel-mass', { tempLimit: { low: '60', high: '70', unit: '°C' }, viscosityLimit: { low: '4000', high: '9000', unit: 'mPa·s' }, waterLimit: { low: '28', high: '34', unit: '%' } }, { minMinutes: 60 }],
  ['softgel-encapsulate', { ribbonLimit: { low: '0.75', high: '0.85', unit: 'mm' }, wedgeLimit: { low: '36', high: '40', unit: '°C' }, fillTarget: { header: 'fillWeight' },
    meanLimit: { low: '97.0', high: '103.0', unit: 'mg' }, weightBand: '5.0', sealLimit: { low: '0.30', unit: 'mm' } }, { everyMinutes: 30, flow: { kind: 'repeat-until', maxRounds: 40 } }],
  ['softgel-dry', { tempLimit: { low: '20', high: '25', unit: '°C' }, rhLimit: { low: '15', high: '25', unit: '%RH' }, hardnessLimit: { low: '8', high: '12', unit: 'N' } }, { minMinutes: 2880, flow: { kind: 'repeat-until', maxRounds: 30 } }],
  ['softgel-dry-water', { tempLimit: { low: '20', high: '25', unit: '°C' }, rhLimit: { low: '15', high: '25', unit: '%RH' }, waterLimit: { low: '6', high: '9', unit: '%' } }, { flow: { kind: 'repeat-until', maxRounds: 30 } }],
  ['dry-observe', { endPoint: 'Fill melted in every capsule of the sample', tempLimit: { low: '65', high: '75', unit: '°C' } }, { flow: { kind: 'repeat-until', maxRounds: 10 } }],
  ['checkweigh', { weightLimit: { low: '165.0', high: '185.0', unit: 'mg' } }, { everyMinutes: 60, flow: { kind: 'repeat-until', maxRounds: 40 } }],
  ['check-observe', { what: 'Suspension homogeneous, no lumps' }],
];
const using = (id: string, settings: object, options: object = {}): MasterDoc => {
  const b = findBlock({ id, version: 1 })!;
  const step = { key: id, block: { id, version: 1 }, checker: b.checker, settings, ...options };
  return small([{ role: 'Production operator', steps: b.gmp === 'yield' ? [step] : [step, yieldStep] }]);
};

describe('the standard capsule blocks', () => {
  it.each(NEW)('the %s block is a valid description, and a small master using it passes the master check', (id, settings, options) => {
    expect(blockProblems(findBlock({ id, version: 1 })!)).toEqual([]);
    expect(checks(using(id, settings, options)).map((p) => `${p.path}: ${p.message}`)).toEqual([]);
  });

  it('a liquid make-up is worked out in the master check before any batch: 0.100 kg binder at 10 % solids needs 0.900 kg of solvent', () => {
    const doc = using('binder-solution', NEW[1]![1]);
    expect(evaluate(doc, [], { stage: 0, sub: 1, step: 0, round: 1 }, {}).makeUp).toMatchObject({ ok: true, value: '0.9', unit: 'kg' });
  });

  it('a binder solution may dissolve several materials (a binder and polysorbate): their quantities count together in the make-up', () => {
    const doc = using('binder-solution', { ...NEW[1]![1], binder2: '0.020 kg' });
    const r = evaluate(doc, [], { stage: 0, sub: 1, step: 0, round: 1 }, {}).makeUp;
    expect(r).toMatchObject({ ok: true, value: '1.08', unit: 'kg', shown: expect.stringContaining('0.020 kg second material') });
    expect(checks(doc).map((p) => p.message)).toEqual([]);
  });

  it('an overage may be set on any line, not only the API: a coating powder made with 10 % spray loss', () => {
    const doc = using('weigh', { target: { formula: 'x', adjusted: true }, tolerance: '0.5' });
    doc.formula[0]!.adjust = { overage: { percent: '10' } };
    expect(evaluate(doc, [], { stage: 0, sub: 1, step: 0, round: 1 }, {}).target).toMatchObject({ ok: true, value: '0.11', unit: 'kg' });
    expect(checks(doc).map((p) => p.message)).toEqual([]);
  });
});

/** Records a step's values (results from the engine) and signs it done, checked by a second person when it needs it. */
function walk(doc: MasterDoc, events: StepEvent[], key: string, values: Record<string, Value>): StepEvent[] {
  const k = parseKey(key)!;
  const uses: number[] = [];
  const results = evaluate(doc, events, k, values, uses);
  const recorded = [...events, ev('started', key), ev('value', key, { payload: { values, results, uses } })];
  const view = openSteps(doc, recorded, at(10_000)).steps.find((s) => s.id === key)!;
  expect(doneProblems(doc, view, at(10_000)), key).toEqual([]);
  const done = [...recorded, ev('done', key)];
  return doc.stages[k.stage]!.steps[k.step]!.checker ? [...done, ev('checked', key, { person: 2 })] : done;
}
const kg = (value: string) => ({ value, unit: 'kg' });
const n = (value: string, unit: string, count: number) => Array.from({ length: count }, () => ({ value, unit }));

describe('the engine runs the new blocks like any other', () => {
  // Granulation gives 0.098 kg of granules; blending lubricates on that weight; filling: one round of 20 gross weights,
  // the metal detector challenge, and the capsules reconciled by weight with the mean filled-capsule weight.
  const S = (id: string) => NEW.find((x) => x[0] === id)![1];
  const doc = small([
    { key: 'granulation', role: 'Granulation operator', steps: [{ ...yieldStep, settings: { ...yieldStep.settings, accountabilityLimit: pct('99.0', '100.5') } }] },
    { key: 'blending', role: 'Granulation operator', steps: [
      { key: 'lubricate', block: { id: 'lubricate', version: 1 }, checker: true, settings: { ...S('lubricate'), granuleWeight: { ref: 'granulation/yield/output' } } },
      { key: 'blend', block: { id: 'dry-mix', version: 1 }, checker: false, settings: { mixTimeLimit: { low: '3', high: '5', unit: 'min' } } },
      { ...yieldStep, settings: { ...yieldStep.settings, theoretical: '0.098 kg' } }] },
    { key: 'filling', role: 'Filling operator', steps: [
      { key: 'fill', block: { id: 'capsule-fill', version: 1 }, checker: false, everyMinutes: 30, flow: { kind: 'repeat-until', maxRounds: 40 }, settings: S('capsule-fill') },
      { key: 'metal', block: { id: 'metal-check', version: 1 }, checker: false, everyMinutes: 60, flow: { kind: 'repeat-until', maxRounds: 40 }, settings: S('metal-check') },
      { key: 'reconcile', block: { id: 'capsule-reconciliation', version: 1 }, checker: true, settings: { ...S('capsule-reconciliation'), meanWeight: { ref: 'filling/fill/meanWeight' } } }] },
  ]);
  const mixing = (from: string, to: string) => ({ mixStart: `2026-11-15T08:${from}:00Z`, mixEnd: `2026-11-15T08:${to}:00Z` });
  const caps = (value: string) => ({ value, unit: 'capsules' });
  const challenge = { machine: 'MD-01', fe: 'yes', nonFe: 'yes', ss: 'yes', rejected: caps('0'), runDone: 'yes' };

  it('record → done, step by step: lubricant re-scaled to the actual granules, fill weights and the metal check each round, capsules reconciled', () => {
    expect(checks(doc)).toEqual([]);
    let e: StepEvent[] = walk(doc, [], '0.1.0.1', { output: kg('0.098'), samples: kg('0.001'), rejects: kg('0.001') });
    // 0.100 kg lubricant × 0.098 kg ÷ 0.100 kg = 0.098 kg; net 0.5980 − 0.5000 = 0.0980 kg
    const lub = { lot: 'L-1', balance: 'BAL-01', gross: kg('0.5980'), tare: kg('0.5000'), machine: 'BLN-01', ...mixing('00', '11') };
    expect(evaluate(doc, e, parseKey('1.1.0.1')!, lub).rescaled).toMatchObject({ ok: true, value: '0.098', unit: 'kg' });
    e = walk(doc, e, '1.1.0.1', lub);
    e = walk(doc, e, '1.1.1.1', { machine: 'BLN-01', speed: { value: '12', unit: 'rpm' }, ...mixing('12', '16') });
    e = walk(doc, e, '1.1.2.1', { output: kg('0.098'), samples: kg('0'), rejects: kg('0') });
    const round = { machine: 'CF-01', weights: n('175.0', 'mg', 20), length: n('19.4', 'mm', 5), appearance: 'yes', rejected: caps('0'), fillingDone: 'yes' };
    expect(evaluate(doc, e, parseKey('2.1.0.1')!, round)).toMatchObject({ meanWeight: { ok: true, value: '175', check: { pass: true } },
      individualWeights: { ok: true, check: { pass: true } }, lengthCheck: { ok: true, check: { pass: true } } });
    e = walk(doc, e, '2.1.0.1', round);
    e = walk(doc, e, '2.1.1.1', challenge);
    // 0.17150 kg ÷ 175.0 mg = 980 capsules; rejects 0.00175 kg ÷ 175.0 mg = 10; 980 + 10 + 10 = 1000 of 1000
    const counted = { output: kg('0.17150'), rejectWeight: kg('0.00175'), samples: caps('10') };
    expect(evaluate(doc, e, parseKey('2.1.2.1')!, counted).accountability).toMatchObject({ ok: true, value: '100', check: { pass: true } });
    e = walk(doc, e, '2.1.2.1', counted);
    const { stages, steps } = openSteps(doc, e, at(10_000));
    expect(stages.map((s) => s.closed)).toEqual([true, true, true]);
    expect(steps.map((s) => s.state)).toEqual(['checked', 'checked', 'done', 'checked', 'done', 'done', 'checked']);
  });

  it('TC-15 a fill weight outside the band fails the round, so the round needs a deviation note', () => {
    const light = { machine: 'CF-01', weights: [...n('175.0', 'mg', 19), { value: '140.0', unit: 'mg' }], length: n('19.4', 'mm', 5), appearance: 'yes', rejected: caps('1'), fillingDone: 'no' };
    expect(evaluate(doc, [], parseKey('2.1.0.1')!, light).individualWeights).toMatchObject({ ok: true, check: { pass: false } });
  });

  it('TC-14 metal check: a test piece not rejected fails the check, so the step needs a deviation note', () => {
    const missed = { ...challenge, ss: 'no' };
    const r = evaluate(doc, [], parseKey('2.1.1.1')!, missed);
    expect(r.challenge).toMatchObject({ ok: true, check: { pass: false } });
    const one = small([{ steps: [{ key: 'metal', block: { id: 'metal-check', version: 1 }, checker: false, everyMinutes: 60, flow: { kind: 'repeat-until', maxRounds: 40 }, settings: S('metal-check') }] }]);
    const events = [ev('started', '0.1.0.1', { min: 0 }), ev('value', '0.1.0.1', { min: 1, payload: { values: missed, results: r } })];
    const v = (x: StepEvent[]) => doneProblems(one, openSteps(one, x, at(5)).steps[0]!, at(5));
    expect(v(events)).toEqual(['Out of limits: Test pieces detected and rejected. Add a deviation note first.']);
    expect(v([...events, ev('note', '0.1.0.1', { min: 2, payload: { text: 'Stainless test piece passed; detector re-set, capsules since the last check re-checked' } })])).toEqual([]);
  });

  it('TC-24 banding: one leaking capsule fails the leak check (none allowed); the count reads in capsules', () => {
    const band = small([{ steps: [{ key: 'band', block: { id: 'capsule-band', version: 1 }, checker: false, everyMinutes: 30, flow: { kind: 'repeat-until', maxRounds: 40 }, settings: S('capsule-band') }] }]);
    const key = parseKey('0.1.0.1')!;
    const values = { machine: 'BND-01', bandTemp: { value: '50', unit: '°C' }, appearance: 'yes', bandingDone: 'yes' };
    expect(evaluate(band, [], key, { ...values, leakers: caps('0') }).leakCheck).toMatchObject({ ok: true, check: { pass: true }, shown: '0 capsules; limit not more than 0 capsules: within limits' });
    expect(evaluate(band, [], key, { ...values, leakers: caps('1') }).leakCheck).toMatchObject({ ok: true, check: { pass: false } });
  });

  it('soft gel: the fill of each capsule is the capsule less its washed shell (T7 per capsule); drying stops when every capsule is hard enough', () => {
    const sg = small([{ steps: [
      { key: 'encapsulate', block: { id: 'softgel-encapsulate', version: 1 }, checker: false, everyMinutes: 30, flow: { kind: 'repeat-until', maxRounds: 40 }, settings: S('softgel-encapsulate') },
      { key: 'dry', block: { id: 'softgel-dry', version: 1 }, checker: false, minMinutes: 2880, flow: { kind: 'repeat-until', maxRounds: 30 }, settings: S('softgel-dry') }] }]);
    const pair = (full: string, shell: string) => [{ value: full, unit: 'mg' }, { value: shell, unit: 'mg' }];
    const capsules = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c${i + 1}`, pair('400.0', '300.0')]));
    const r = evaluate(sg, [], parseKey('0.1.0.1')!, { machine: 'ENC-01', ribbonLeft: { value: '0.80', unit: 'mm' }, ribbonRight: { value: '0.81', unit: 'mm' },
      wedgeTemp: { value: '38', unit: '°C' }, ...capsules, seal: { value: '0.35', unit: 'mm' }, noLeakers: 'yes', rejected: caps('0'), encapsulationDone: 'yes' } as Record<string, Value>);
    expect(r.meanFill).toMatchObject({ ok: true, value: '100', check: { pass: true } });
    expect(r.individualFills).toMatchObject({ ok: true, check: { pass: true } });
    const hard = (v: string) => evaluate(sg, [], parseKey('0.1.1.1')!, { temperature: { value: '22', unit: '°C' }, rh: { value: '20', unit: '%RH' }, hardness: n(v, 'N', 5) }).hardnessEach;
    expect(hard('6')).toMatchObject({ ok: true, check: { pass: false } });
    expect(hard('9')).toMatchObject({ ok: true, check: { pass: true } });
  });

  it('a staged test: disintegration needs the 12 more capsules only when 1 or 2 of the first 6 fail', () => {
    const d = using('disintegration', NEW.find((x) => x[0] === 'disintegration')![1]);
    const key = { stage: 0, sub: 1, step: 0, round: 1 };
    const times = (s: string) => s.split(' ').map((value) => ({ value, unit: 'min' }));
    expect(evaluate(d, [], key, { times: times('5 6 7 8 9 10') }).stages).toMatchObject({ ok: true, decision: 'pass' });
    expect(evaluate(d, [], key, { times: times('5 6 7 8 9 16') }).stages).toMatchObject({ ok: true, decision: 'next stage', nextStageUnits: 12 });
    expect(evaluate(d, [], key, { times: times('5 6 7 8 9 16'), moreTimes: times('5 6 7 8 9 10 5 6 7 8 9 10') }).stages).toMatchObject({ ok: true, decision: 'pass' });
  });
});
