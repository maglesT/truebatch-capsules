import { describe, expect, it } from 'vitest';
import { blockProblems } from '../shared/blocks/format.js';
import { findBlock } from '../shared/blocks/index.js';
import { evaluate } from '../shared/engine/index.js';
import { masterChecks } from '../shared/master/checks.js';
import type { MasterDoc, SettingValue } from '../shared/master/schema.js';
import { stepText } from '../web/src/designer/describe.js';
import { labelClaimLines } from '../web/src/designer/model.js';
import { capsule, unplaced } from './engine-fixture.js';

// Round 29: the label claim per capsule of the uniformity-by-weight block (T14) picked from a formula line is the line's
// label claim, never its batch quantity (10.000 kg of Examplol for 100 000 capsules of 100 mg).

const at = { stage: 2, sub: 1, step: 1, round: 1 };
/** The fixture with a uniformity-by-weight step after filling, its label claim set to `labelClaim`. */
function withUniformity(labelClaim: SettingValue, change?: (d: MasterDoc) => void): MasterDoc {
  const d = capsule();
  d.formula[0]!.labelClaim = '100 mg';
  d.stages[2]!.steps.splice(1, 0, { key: 'uniformity', block: { id: 'uniformity-by-weight', version: 1 }, checker: true, waitForCheck: false, critical: false,
    settings: { coating: 'hard capsule', labelClaim }, flow: { kind: 'none' } });
  change?.(d);
  return d;
}
const errors = (d: MasterDoc) => unplaced(masterChecks(d)).filter((p) => p.level === 'error').map((p) => `${p.path}: ${p.message}`);
// Each capsule full, then its empty shell (75.0 mg): the net contents average `mg`.
const q = (v: number) => ({ value: v.toFixed(1), unit: 'mg' });
const values = (mg = '250.0') => ({ ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c${i + 1}`, [q(Number(mg) + 75 + (i % 2 ? 1 : -1)), q(75)]])),
  assay: { value: '99.0', unit: '%' } });

describe('the label claim per capsule from a formula line (formulaField)', () => {
  it('the engine takes the API line\'s label claim, not its batch quantity, and T14 works with it', () => {
    const d = withUniformity({ formula: 'api' });
    const r = evaluate(d, [], at, values());
    expect(r.labelClaim).toEqual({ ok: true, value: '100', unit: 'mg', shown: '100 mg, the label claim of Examplol (formula line)' });
    // The same acceptance value as the claim typed by hand.
    const typed = evaluate(withUniformity('100 mg'), [], at, values());
    expect(r.acceptance).toEqual(typed.acceptance);
    expect(r.acceptance).toMatchObject({ ok: true, check: { pass: true } });
  });

  it('a claim under 25 mg is refused by T14 (with the batch quantity, 2.000 kg, it passed)', () => {
    const d = withUniformity({ formula: 'api' }, (x) => { Object.assign(x.formula[0]!, { mgPerCapsule: '20.0', labelClaim: '20 mg' }); });
    const r = evaluate(d, [], at, values());
    expect(r.labelClaim).toMatchObject({ ok: true, value: '20', unit: 'mg' });
    expect(r.acceptance).toMatchObject({ ok: false, message: expect.stringMatching(/at least 25 mg of drug.*here 20 mg in 250\.0 mg \(8\.0 %\)/) });
  });

  it('the master accepts the API line\'s label claim, and the step adds nothing to its stage\'s yield', () => {
    expect(errors(withUniformity({ formula: 'api' }))).toEqual([]);
    // A yield on the granules: the uniformity step names the API but does not add it to filling.
    const onGranules = (d: MasterDoc) => { d.stages[2]!.steps.at(-1)!.settings.theoretical = { ref: 'granulation/yield/output' }; };
    expect(errors(withUniformity({ formula: 'api' }, onGranules))).toEqual([]);
    // A step that does add a material is still counted.
    const charge = (d: MasterDoc) => { d.stages[2]!.steps.splice(2, 0, { key: 'charge-mgst', block: { id: 'charge', version: 1 }, checker: true, waitForCheck: false, critical: false, settings: { material: { formula: 'mgst' } }, flow: { kind: 'none' } }); };
    expect(errors(withUniformity({ formula: 'api' }, (d) => { onGranules(d); charge(d); })))
      .toEqual([expect.stringMatching(/^stages\[2\]\.steps\[\d\]\.settings\.theoretical: The yield of Filling is worked out on the output of Granulation only, but Filling adds Magnesium stearate:/)]);
  });

  it('the master refuses a line without a label claim, a header value, an earlier step and an adjusted line', () => {
    const p = 'stages[2].steps[1].settings.labelClaim';
    expect(errors(withUniformity({ formula: 'api' }, (d) => { delete d.formula[0]!.labelClaim; })))
      .toEqual([`${p}: The label claim per capsule points at Examplol, which has no label claim: enter it on the formula line`]);
    expect(errors(withUniformity({ formula: 'lactose' })))
      .toEqual([`${p}: The label claim per capsule points at Lactose monohydrate, which has no label claim: enter it on the formula line`]);
    expect(errors(withUniformity({ header: 'fillWeight' })))
      .toEqual([`${p}: Label claim per capsule: pick the label claim of a formula line, or type it; a header value is not a label claim per capsule`]);
    expect(errors(withUniformity({ ref: 'filling/fill/meanWeight' })))
      .toEqual([`${p}: Label claim per capsule: pick the label claim of a formula line, or type it; an earlier step is not a label claim per capsule`]);
    expect(errors(withUniformity({ formula: 'api', adjusted: true })))
      .toEqual([`${p}: Label claim per capsule: the label claim of Examplol is never adjusted for the lot`]);
  });

  it('any other quantity setting still takes the batch quantity of a line', () => {
    const d = capsule();
    expect(evaluate(d, [], { stage: 0, sub: 1, step: 0, round: 1 }, {}).target).toMatchObject({ ok: true, value: '1', unit: 'kg' });
    expect(findBlock({ id: 'weigh', version: 1 })!.settings.find((s) => s.name === 'target')!.formulaField).toBeUndefined();
  });

  it('a block may give formulaField only to a quantity setting', () => {
    const b = findBlock({ id: 'uniformity-by-weight', version: 1 })!;
    expect(blockProblems(b)).toEqual([]);
    expect(blockProblems({ ...b, settings: [{ name: 'coating', label: 'Coating', kind: 'text', formulaField: 'labelClaim' }, b.settings[1]!] }))
      .toEqual(['setting coating: only a quantity setting reads a field of a formula line']);
  });

  it('the designer offers the lines with a label claim, the API first, and reads the setting as the line\'s label claim', () => {
    const d = withUniformity({ formula: 'api' }, (x) => { x.formula[1]!.labelClaim = '5 mg'; });
    expect(labelClaimLines(d).map((l) => l.key)).toEqual(['api', 'lactose']);
    expect(labelClaimLines(d, 'mcc').map((l) => l.key)).toEqual(['api', 'lactose', 'mcc']);
    expect(stepText(d, d.stages[2]!.steps[1]!, 1)).toContain('the label claim of Examplol (100 mg)');
    expect(stepText(d, d.stages[2]!.steps[1]!, 1)).not.toContain('batch quantity');
  });
});

describe('a label claim in IU', () => {
  it('a formula line may state its label claim in IU (no mass to compare with the mg per capsule)', () => {
    const d = capsule();
    Object.assign(d.formula[0]!, { name: 'Cholecalciferol', labelClaim: '60000 IU' });
    expect(errors(d)).toEqual([]);
    d.formula[0]!.labelClaim = '60000 kcal';
    expect(errors(d)).toEqual(['formula[0].labelClaim: "60000 kcal" is not a label claim with a unit, e.g. "20 mg", "10 mEq" or "60000 IU"']);
  });

  it('the weight-variation method refuses a claim in IU at the master (its 25 mg rule is on the mass of drug)', () => {
    const iu = (d: MasterDoc) => { d.formula[0]!.labelClaim = '60000 IU'; };
    expect(errors(withUniformity({ formula: 'api' }, iu)))
      .toEqual(['stages[2].steps[1].settings.labelClaim: Label claim per capsule: the label claim of Examplol is 60000 IU, but this step needs a mass per capsule']);
    expect(errors(withUniformity('60000 IU')))
      .toEqual(['stages[2].steps[1].settings.labelClaim: Label claim per capsule: 60000 IU is not a mass per capsule, which this step needs']);
  });
});
