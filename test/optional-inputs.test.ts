// "$name?" promises that an optional field or setting left out is left out: a limit check of an optional reading not
// given, or against an optional limit the master did not set, checks nothing. And a count may be a counted value. No
// block of the library uses these yet (TrueBatch Injectables found them, in code it shares with this engine): these
// test-only blocks do.
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '../shared/blocks/format.js';
import { evaluate } from '../shared/engine/index.js';
import { masterChecks } from '../shared/master/checks.js';
import { small } from './engine-fixture.js';

const TEST_BLOCKS: Record<string, Block> = {
  'optional-reading': { id: 'optional-reading', version: 1, name: 'An optional reading', instruction: 'Record the solvent if tested.', checker: false,
    fields: [{ name: 'assay', label: 'Assay', kind: 'number', unit: '%' }, { name: 'solvent', label: 'Residual solvent', kind: 'number', unit: 'ppm', optional: true }],
    settings: [{ name: 'assayLimit', label: 'Assay limit', kind: 'limit' }, { name: 'solventLimit', label: 'Solvent limit', kind: 'limit' }],
    calcs: [{ name: 'assayCheck', label: 'Assay against limit', template: 'C1', args: { value: '$assay', limit: '$assayLimit' } },
      { name: 'solventCheck', label: 'Solvent against limit', template: 'C1', args: { value: '$solvent?', limit: '$solventLimit' } }] },
  'optional-limit': { id: 'optional-limit', version: 1, name: 'An optional limit', instruction: 'Record the temperature.', checker: false,
    fields: [{ name: 'temperature', label: 'Temperature', kind: 'number', unit: '°C' }],
    settings: [{ name: 'temperatureLimit', label: 'Temperature limit', kind: 'limit', optional: true }],
    calcs: [{ name: 'temperatureCheck', label: 'Temperature against limit', template: 'C1', args: { value: '$temperature', limit: '$temperatureLimit?' } }] },
  counted: { id: 'counted', version: 1, name: 'A counted value', instruction: 'Count the probes placed.', checker: false,
    fields: [{ name: 'probes', label: 'Probes placed', kind: 'number', unit: 'units' }],
    settings: [{ name: 'probesRequired', label: 'Probes required', kind: 'number' }],
    calcs: [{ name: 'probesCheck', label: 'Probes placed', template: 'C2', args: { readings: '$probes', required: '$probesRequired', mode: 'at least' } }] },
};
vi.mock('../shared/blocks/index.js', async (original) => {
  const m = await original<typeof import('../shared/blocks/index.js')>();
  return { ...m, findBlock: (ref: { id: string; version: number }) => TEST_BLOCKS[ref.id] ?? m.findBlock(ref) };
});

const one = (id: string, settings: object) => small([{ steps: [{ block: { id, version: 1 }, settings }] }]);
const run = (doc: ReturnType<typeof small>, values: object) => evaluate(doc, [], { stage: 0, sub: 1, step: 0, round: 1 }, values as never);
const calcProblems = (doc: ReturnType<typeof small>) => masterChecks(doc).filter((p) => /against limit|Probes/.test(p.message));

describe('an optional reading or limit, and a counted value', () => {
  it('an optional reading left blank checks nothing (was "The value is missing", so the step could not be signed); given, it is checked', () => {
    const doc = one('optional-reading', { assayLimit: { low: '95.0', high: '105.0', unit: '%' }, solventLimit: { high: '50', unit: 'ppm' } });
    const blank = run(doc, { assay: { value: '99.0', unit: '%' } });
    expect(blank.assayCheck).toMatchObject({ ok: true, check: { pass: true } });
    expect(blank.solventCheck).toBeUndefined();
    expect(run(doc, { assay: { value: '99.0', unit: '%' }, solvent: { value: '80', unit: 'ppm' } }).solventCheck).toMatchObject({ ok: true, check: { pass: false } });
    expect(calcProblems(doc)).toEqual([]);
  });

  it('a check against an optional limit the master did not set checks nothing (was a crash on the missing limit); set, it checks', () => {
    const t = { temperature: { value: '25', unit: '°C' } };
    expect(run(one('optional-limit', {}), t)).toEqual({});
    expect(calcProblems(one('optional-limit', {}))).toEqual([]);
    expect(run(one('optional-limit', { temperatureLimit: { high: '20', unit: '°C' } }), t).temperatureCheck).toMatchObject({ ok: true, check: { pass: false } });
  });

  it('a count recorded in a number field is counted (was "[DecimalError] Invalid argument: undefined")', () => {
    const doc = one('counted', { probesRequired: '4' });
    expect(run(doc, { probes: { value: '4', unit: 'units' } }).probesCheck).toMatchObject({ ok: true, value: '4', check: { pass: true } });
    expect(run(doc, { probes: { value: '3', unit: 'units' } }).probesCheck).toMatchObject({ ok: true, check: { pass: false } });
  });
});

// Round 39 (found by the TrueBatch Oral Liquids session; port of Tablets round 39): durations() looked an optional time limit ("$timeLimit?") up
// with its "?" still on, so an optional minimum mixing time never became a wait (no timer, no demo skip).
describe('an optional minimum time ("$timeLimit?") is still a wait when the master sets it', async () => {
  const { durations } = await import('../shared/engine/values.js');
  const block: Block = { id: 'optional-time', version: 1, name: 'Mix for at least the time set', instruction: 'Mix.', checker: false,
    fields: [{ name: 'start', label: 'Started', kind: 'timer' }, { name: 'end', label: 'Stopped', kind: 'timer' }],
    settings: [{ name: 'timeLimit', label: 'Mixing time', kind: 'limit', optional: true }],
    calcs: [{ name: 'mixTime', label: 'Mixing time', template: 'T13', args: { mode: 'duration', start: '$start', end: '$end', limit: '$timeLimit?' } }] } as unknown as Block;
  it('set: one wait with its lower limit; not set: none', () => {
    const withLimit = durations(block, { settings: { timeLimit: { low: '10', unit: 'min' } } } as never);
    expect(withLimit).toEqual([{ calc: 'mixTime', label: 'Mixing time', start: 'start', end: 'end', limit: { low: '10', unit: 'min' } }]);
    expect(durations(block, { settings: {} } as never)).toEqual([]);
  });
});
