// Fix round 21 Nov 2026 (B): coated pellets (drug layering, sub-coat, enteric coat) with the two pellet blocks, run
// by the engine like any other block: the master check, record → done, out of limits needs a deviation note.
import { describe, expect, it } from 'vitest';
import { findBlock } from '../shared/blocks/index.js';
import { blockProblems } from '../shared/blocks/format.js';
import { doneProblems, evaluate, openSteps, parseKey, type StepEvent, type Value } from '../shared/engine/index.js';
import { masterChecks } from '../shared/master/checks.js';
import type { MasterDoc } from '../shared/master/schema.js';
import { at, ev, small, unplaced } from './engine-fixture.js';

const checks = (d: MasterDoc) => unplaced(masterChecks(d)).map((p) => `${p.path}: ${p.message}`);
const pct = (low: string, high: string) => ({ low, high, unit: '%' });
const q = (value: string, unit: string) => ({ value, unit });

const COAT = { sprayedLimit: { low: '12.0', high: '12.5', unit: 'kg' }, inletLimit: { low: '50', high: '65', unit: '°C' },
  airPressureLimit: { low: '1.5', high: '2.5', unit: 'bar' }, bedLimit: { low: '38', high: '45', unit: '°C' }, sprayRateLimit: { low: '40', high: '120', unit: 'g/min' } };
const CURE = { coresWeight: '20 kg', gainLimit: pct('28.0', '32.0'), cureTempLimit: { low: '38', high: '45', unit: '°C' }, cureTimeLimit: { low: '30', unit: 'min' },
  screens: '1.4 mm and 0.71 mm', fractionLimit: pct('95.0', '100.0') };
const pellets = () => small([{ role: 'Coating operator', steps: [
  { key: 'coat', block: { id: 'pellet-coat', version: 1 }, checker: false, everyMinutes: 30, flow: { kind: 'repeat-until', maxRounds: 30 }, settings: COAT },
  { key: 'cure', block: { id: 'pellet-cure-sieve', version: 1 }, checker: true, settings: CURE },
  { key: 'yield', block: { id: 'stage-yield', version: 1 }, checker: true, settings: { theoretical: '26 kg', yieldLimit: pct('97.0', '100.5') } }] }]);
const round = (o: Record<string, Value> = {}): Record<string, Value> => ({ machine: 'EQ-WUR-01', inletTemp: q('58', '°C'), bedTemp: q('41', '°C'),
  sprayRate: q('80', 'g/min'), airPressure: q('2.0', 'bar'), sprayed: q('2.4', 'kg'), ...o });
const cure = (o: Record<string, Value> = {}): Record<string, Value> => ({ dryer: 'EQ-WUR-01', cureTemp: q('40', '°C'), cureTime: q('45', 'min'), coatedWeight: q('26.0', 'kg'),
  sifter: 'EQ-SFT-01', intactBefore: 'yes', kept: q('25.4', 'kg'), oversize: q('0.4', 'kg'), fines: q('0.2', 'kg'), intactAfter: 'yes', ...o });

const K = (key: string) => parseKey(key)!;
function problems(doc: MasterDoc, key: string, values: Record<string, Value>, extra: StepEvent[] = []): string[] {
  const results = evaluate(doc, [], K(key), values);
  const events = [ev('started', key, { min: 0 }), ev('value', key, { min: 1, payload: { values, results } }), ...extra];
  return doneProblems(doc, openSteps(doc, events, at(60)).steps.find((s) => s.id === key)!, at(60));
}

describe('coated pellets', () => {
  it('both are valid blocks, and a small master with them (and the stage yield) passes the master check', () => {
    expect(blockProblems(findBlock({ id: 'pellet-coat', version: 1 })!)).toEqual([]);
    expect(blockProblems(findBlock({ id: 'pellet-cure-sieve', version: 1 })!)).toEqual([]);
    expect(checks(pellets())).toEqual([]);
  });

  it('pellet coat: the spray conditions are checked each round, and the rounds go on until the suspension the master says is sprayed', () => {
    const doc = pellets();
    const r = evaluate(doc, [], K('0.1.0.1'), round());
    for (const c of ['inletCheck', 'bedCheck', 'sprayRateCheck', 'airPressureCheck']) expect(r[c], c).toMatchObject({ ok: true, check: { pass: true } });
    expect(r.sprayedCheck).toMatchObject({ ok: true, check: { pass: false } });
    expect(problems(doc, '0.1.0.1', round())).toEqual([]);
    expect(evaluate(doc, [], K('0.1.0.9'), round({ sprayed: q('12.2', 'kg') })).sprayedCheck).toMatchObject({ ok: true, check: { pass: true } });
  });

  it('pellet coat: a product temperature out of limits needs a deviation note before the round is signed', () => {
    const doc = pellets();
    expect(problems(doc, '0.1.0.1', round({ bedTemp: q('48', '°C') }))).toEqual(['Out of limits: Product temperature. Add a deviation note first.']);
  });

  it('cure and sieve: weight gain on the kilograms of cores, curing time and temperature, sieve fraction kept, screens', () => {
    const doc = pellets();
    const r = evaluate(doc, [], K('0.1.1.1'), cure());
    expect(r.gain).toMatchObject({ ok: true, value: '30', check: { pass: true } });
    expect(r.gain!.ok && r.gain!.shown).toContain('gain on the starting weight');
    expect(r.fraction).toMatchObject({ ok: true, check: { pass: true } });
    for (const c of ['cureTempCheck', 'cureTimeCheck', 'screenCheck']) expect(r[c], c).toMatchObject({ ok: true, check: { pass: true } });
    expect(problems(doc, '0.1.1.1', cure())).toEqual([]);
    // 27.0 kg: 35 % gain; 25.4 of 27.0 kg kept: 94.1 %.
    const bad = cure({ coatedWeight: q('27.0', 'kg'), cureTime: q('20', 'min'), intactAfter: 'no' });
    expect(problems(doc, '0.1.1.1', bad)).toEqual(['Out of limits: Drying or curing time, Weight gain on the cores, Sieve fraction kept, Screens. Add a deviation note first.']);
  });
});
