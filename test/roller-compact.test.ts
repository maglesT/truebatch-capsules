// Round 46 (port): roller compaction (dry granulation of capsule granules), run by the engine like any other block:
// the master check, record → done, out of limits needs a deviation note. (Tablets' device assembly is not ported:
// not a capsule step.)
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
const yieldStep = { key: 'yield', block: { id: 'stage-yield', version: 1 }, checker: true, settings: { theoretical: '100 kg', yieldLimit: pct('97.0', '100.5') } };

const ROLLER = { forceUnit: 'kN/cm', forceLimit: { low: '6', high: '10', unit: 'kN/cm' }, gapLimit: { low: '2.0', high: '3.0', unit: 'mm' },
  rollSpeedLimit: { low: '3', high: '8', unit: 'rpm' }, screen: '1.0 mm', densityLimit: { low: '0.90', high: '1.20', unit: 'g/cm³' }, finesLimit: { high: '30', unit: '%' } };
const roller = (settings: object = ROLLER) => small([{ role: 'Granulation operator', steps: [
  { key: 'compact', block: { id: 'roller-compact', version: 1 }, checker: false, everyMinutes: 30, flow: { kind: 'repeat-until', maxRounds: 20 }, settings }, yieldStep] }]);
const round = (o: Record<string, Value> = {}): Record<string, Value> => ({ machine: 'RC-01', rollForce: q('8.0', 'kN/cm'), rollGap: q('2.5', 'mm'), rollSpeed: q('5', 'rpm'),
  feedSpeed: q('40', 'rpm'), ribbonThickness: [q('2.4', 'mm'), q('2.5', 'mm'), q('2.6', 'mm')], ribbonDensity: q('1.05', 'g/cm³'), fines: q('22.0', '%'),
  screenOk: 'yes', compactionDone: 'no', ...o });

const K = (key: string) => parseKey(key)!;
/** Records the values and asks what stops the performer signing done. */
function problems(doc: MasterDoc, key: string, values: Record<string, Value>, extra: StepEvent[] = []): string[] {
  const results = evaluate(doc, [], K(key), values);
  const events = [ev('started', key, { min: 0 }), ev('value', key, { min: 1, payload: { values, results } }), ...extra];
  return doneProblems(doc, openSteps(doc, events, at(60)).steps.find((s) => s.id === key)!, at(60));
}

describe('roller compaction', () => {
  it('is a valid block, and a small master using it (with the stage yield after it) passes the master check', () => {
    expect(blockProblems(findBlock({ id: 'roller-compact', version: 1 })!)).toEqual([]);
    expect(checks(roller())).toEqual([]);
  });

  it('a round: set points and ribbon within the master\'s limits; the rounds stop when compaction is finished', () => {
    const doc = roller();
    const r = evaluate(doc, [], K('0.1.0.1'), round());
    for (const c of ['forceCheck', 'gapCheck', 'rollSpeedCheck', 'densityCheck', 'finesCheck', 'screenCheck']) expect(r[c], c).toMatchObject({ ok: true, check: { pass: true } });
    expect(r.meanThickness).toMatchObject({ ok: true, value: '2.5', unit: 'mm' });
    // No feed screw limit and no thickness limit set: those checks are left out.
    expect(r.feedSpeedCheck).toBeUndefined();
    expect(r.finished).toMatchObject({ ok: true, check: { pass: false } });
    expect(problems(doc, '0.1.0.1', round())).toEqual([]);
    expect(evaluate(doc, [], K('0.1.0.2'), round({ compactionDone: 'yes' })).finished).toMatchObject({ ok: true, check: { pass: true } });
  });

  it('the roll force in bar when the compactor shows the hydraulic pressure; a limit in another kind is a master-check refusal', () => {
    const bar = roller({ ...ROLLER, forceUnit: 'bar', forceLimit: { low: '40', high: '80', unit: 'bar' } });
    expect(checks(bar)).toEqual([]);
    expect(evaluate(bar, [], K('0.1.0.1'), round({ rollForce: q('60', 'bar') })).forceCheck).toMatchObject({ ok: true, check: { pass: true } });
    const mixed = roller({ ...ROLLER, forceUnit: 'bar' });
    expect(checks(mixed).join('\n')).toMatch(/every reading would be refused/);
  });

  it('out of limits (roll gap, fines, a damaged screen): the round needs a deviation note before it is signed', () => {
    const doc = roller();
    const bad = round({ rollGap: q('3.4', 'mm'), fines: q('35.0', '%'), screenOk: 'no' });
    expect(problems(doc, '0.1.0.1', bad)).toEqual(['Out of limits: Roll gap, Fines, Mill screen. Add a deviation note first.']);
    expect(problems(doc, '0.1.0.1', bad, [ev('note', '0.1.0.1', { min: 2, payload: { text: 'Gap drifted; roll pressure reset, screen replaced' } })])).toEqual([]);
  });
});
