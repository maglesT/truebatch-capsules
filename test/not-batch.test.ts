import { describe, expect, it } from 'vitest';
import { blockProblems } from '../shared/blocks/format.js';
import { BLOCKS, findBlock } from '../shared/blocks/index.js';
import { masterChecks } from '../shared/master/checks.js';
import type { MasterDoc, SettingValue, Step } from '../shared/master/schema.js';
import { quantityChoices } from '../web/src/designer/model.js';
import { capsule, unplaced } from './engine-fixture.js';
import { packing } from './packing-fixture.js';

// Port of Tablets round 31: a quantity setting that is never a batch quantity (notBatch) takes no formula line (its
// batch quantity) and no batch value of the header: a fill target of 25.000 kg would refuse every capsule, and a largest
// change of some kilograms let every round of drying to constant weight pass. And a formula line (a mass) is refused
// for a setting of another known kind.

const errors = (d: MasterDoc) => unplaced(masterChecks(d)).filter((p) => p.level === 'error').map((p) => `${p.path}: ${p.message}`);
const pct = (low: string, high: string) => ({ low, high, unit: '%' });
/** The capsule fixture with a step added at the end of coating; returns the doc and the step's settings path. */
function withStep(block: string, settings: Step['settings'], flow: Step['flow'] = { kind: 'none' }): [MasterDoc, string] {
  const d = capsule();
  const si = d.stages.findIndex((s) => s.key === 'coating');
  const steps = d.stages[si]!.steps;
  steps.push({ key: 'added', block: { id: block, version: 1 }, checker: true, waitForCheck: false, critical: false, flow, settings });
  return [d, `stages[${si}].steps[${steps.length - 1}].settings`];
}
/** The capsule fixture with the spray coat's weight before the coat set to `v`. */
function withCoreWeight(v: SettingValue): [MasterDoc, string] {
  const d = capsule();
  const si = d.stages.findIndex((s) => s.key === 'coating');
  d.stages[si]!.steps[0]!.settings.coreWeight = v;
  return [d, `stages[${si}].steps[0].settings.coreWeight`];
}
const MEAN = 'Mean filled-capsule weight (after the last weight-changing step)';
const reconcile = (meanWeight: SettingValue, theoretical: SettingValue = { header: 'batchSize' }) =>
  withStep('capsule-reconciliation', { theoretical, meanWeight, yieldLimit: pct('97.0', '100.5'), accountabilityLimit: pct('99.0', '100.5') });
const dryConstant = (maxChange: SettingValue) => withStep('dry-constant', { maxChange }, { kind: 'repeat-until', maxRounds: 5 });
const perCapsule = (label: string, what: string) => `${label} is a weight per capsule: pick the fill, shell or filled capsule weight from the header, an earlier step's result, or type it (${what} is per batch)`;

describe('not a batch quantity (notBatch)', () => {
  it('is set on the fill targets, the coat\'s weight before it, the mean capsule weights (per capsule), and the drying tolerance', () => {
    const marked = BLOCKS.flatMap((b) => b.settings.filter((s) => s.notBatch).map((s) => `${b.id}.${s.name}: ${s.notBatch}`)).sort();
    expect(marked).toEqual(['capsule-fill-net.fillTarget: tablet', 'capsule-reconciliation.meanWeight: tablet', 'dry-constant.maxChange: tolerance',
      'finished-goods.meanWeight: tablet', 'softgel-encapsulate.fillTarget: tablet', 'spray-coat.coreWeight: tablet']);
    for (const b of BLOCKS) expect(blockProblems(b)).toEqual([]);
  });

  it('a block may give it only to a quantity setting, and not with formulaField', () => {
    const b = findBlock({ id: 'capsule-reconciliation', version: 1 })!;
    const [theoretical, meanWeight, yieldLimit, ...rest] = b.settings;
    expect(blockProblems({ ...b, settings: [theoretical!, meanWeight!, { ...yieldLimit!, notBatch: 'tablet' }, ...rest] }))
      .toEqual(['setting yieldLimit: only a quantity setting is marked not a batch quantity']);
    expect(blockProblems({ ...b, settings: [theoretical!, { ...meanWeight!, formulaField: 'labelClaim' }, yieldLimit!, ...rest] }))
      .toEqual(['setting meanWeight: a setting that is not a batch quantity does not read a field of a formula line']);
  });

  it('a weight per capsule: the master refuses a formula line and the batch values of the header', () => {
    const cases: [SettingValue, string][] = [
      [{ formula: 'api' }, 'the batch quantity of Examplol'],
      [{ formula: 'api', adjusted: true }, 'the batch quantity of Examplol'],
      [{ header: 'fillBatch' }, 'the theoretical fill batch weight'],
      [{ header: 'coatedBatch' }, 'the theoretical coated batch weight'],
      [{ header: 'batchSize' }, 'the batch size'],
    ];
    for (const [v, what] of cases) {
      const [d, p] = withCoreWeight(v);
      expect(errors(d)).toEqual([`${p}: ${perCapsule('Weight before this coat', what)}`]);
    }
    const [r, q] = reconcile({ formula: 'lactose' });
    expect(errors(r)).toEqual([`${q}.meanWeight: ${perCapsule(MEAN, 'the batch quantity of Lactose monohydrate')}`]);
  });

  it('a weight per capsule: the master takes the capsule weights of the header, an earlier step and a typed value', () => {
    for (const v of [{ header: 'fillWeight' }, { header: 'coatedWeight' }, { header: 'filledWeight' }, { ref: 'filling/fill/meanWeight' }, '325.0 mg'] as SettingValue[]) {
      expect(errors(withCoreWeight(v)[0])).toEqual([]);
      expect(errors(reconcile(v)[0])).toEqual([]);
    }
  });

  it('the packing finished goods refuse a batch value too', () => {
    const pk = packing();
    expect(errors(pk)).toEqual([]);
    const si = pk.stages.findIndex((s) => s.steps.some((t) => t.block.id === 'finished-goods'));
    const ti = pk.stages[si]!.steps.findIndex((t) => t.block.id === 'finished-goods');
    pk.stages[si]!.steps[ti]!.settings.meanWeight = { header: 'fillBatch' };
    expect(errors(pk)).toEqual([`stages[${si}].steps[${ti}].settings.meanWeight: ${perCapsule('Mean capsule weight', 'the theoretical fill batch weight')}`]);
  });

  it('a tolerance (dry to constant weight): typed only', () => {
    expect(errors(dryConstant('0.5 mg')[0])).toEqual([]);
    const cases: [SettingValue, string][] = [
      [{ formula: 'api' }, 'the batch quantity of Examplol'],
      [{ header: 'fillBatch' }, 'the theoretical fill batch weight'],
      [{ header: 'fillWeight' }, 'the theoretical fill weight'],
      [{ ref: 'granulation/yield/output' }, 'granulation/yield/output (an earlier step)'],
    ];
    for (const [v, what] of cases) {
      const [d, p] = dryConstant(v);
      expect(errors(d)).toEqual([`${p}.maxChange: Largest change between rounds is a tolerance: type it (${what} is not a tolerance)`]);
    }
  });

  it('every other quantity setting still takes a formula line and a batch value of the header', () => {
    expect(errors(capsule())).toEqual([]);
    const yieldStep = capsule().stages.find((s) => s.key === 'filling')!.steps.find((t) => t.key === 'yield')!;
    expect(yieldStep.settings.theoretical).toEqual({ header: 'fillBatch' });
  });
});

describe('a formula line on a setting of another kind than a mass', () => {
  it('is refused where the kind is known (a number of capsules), and taken where it is a mass', () => {
    const [d, p] = reconcile('325.0 mg', { formula: 'api' });
    expect(errors(d)).toEqual([`${p}.theoretical: Theoretical number of capsules: a formula line gives its batch quantity (a mass), but this step needs a count: type the value`]);
    expect(errors(capsule())).toEqual([]);
  });
});

describe('the designer offers', () => {
  const d = capsule();
  const si = d.stages.findIndex((s) => s.key === 'coating');
  it('for a weight per capsule: the capsule weights of the header and earlier steps, no formula line', () => {
    const c = quantityChoices(d, si, 0, 'mass', 'tablet');
    expect(c).toMatchObject({ lines: false, headers: ['fillWeight', 'coatedWeight', 'shellWeight', 'filledWeight'] });
    expect(c.refs.map((r) => r.ref)).toContain('filling/fill/meanWeight');
    const noCoat = capsule();
    delete noCoat.header.coatedWeightMg;
    expect(quantityChoices(noCoat, si, 0, 'mass', 'tablet').headers).toEqual(['fillWeight', 'shellWeight', 'filledWeight']);
  });

  it('for a tolerance: nothing but a typed value', () => {
    expect(quantityChoices(d, si, 0, 'mass', 'tolerance')).toEqual({ lines: false, headers: [], refs: [] });
  });

  it('for any other quantity: the formula lines, every header value of its kind and earlier steps', () => {
    const c = quantityChoices(d, si, 0, 'mass');
    expect(c).toMatchObject({ lines: true, headers: ['fillWeight', 'coatedWeight', 'fillBatch', 'coatedBatch', 'shellWeight', 'filledWeight'] });
    expect(c.refs.length).toBeGreaterThan(0);
    expect(quantityChoices(d, si, 0, 'count')).toMatchObject({ lines: false, headers: ['batchSize'] });
  });
});
