import { describe, expect, it } from 'vitest';
import { BLOCKS, findBlock } from '../shared/blocks/index.js';
import { blocking, masterChecks } from '../shared/master/checks.js';
import { masterSchema } from '../shared/master/schema.js';
import { stepTitle } from '../shared/engine/batch.js';
import { perPackText } from '../shared/engine/stock.js';
import { describeMaster, diffMasters, stepText } from '../web/src/designer/describe.js';
import { dispensing, workedExample } from '../web/src/designer/example.js';
import { answerDoc, earlierRefs, neededKind, scaleDoc, stepFrom } from '../web/src/designer/model.js';
import { sentence, sentenceText } from '../web/src/designer/sentences.js';
import { SKELETON_LIST, skeletonStages } from '../web/src/designer/skeletons.js';
import { capsule, unplaced } from './engine-fixture.js';
import { packing } from './packing-fixture.js';

// The designer's pure parts: sentences instead of formulas, inputs offered by kind, worked examples and the
// calculation preview through the engine, skeletons, copying to a new batch size, and the changes view.

const block = (id: string) => BLOCKS.find((b) => b.id === id)!;

describe('master designer', () => {
  it('every calculation of the block library reads as a sentence, never a formula', () => {
    for (const b of BLOCKS) for (const c of b.calcs) {
      const words = sentence(b, c).filter((p) => typeof p === 'string').join('');
      expect(words, `${b.id}.${c.name}`).not.toMatch(/[×÷=]|\$|T\d|C\d/);
    }
    const d = capsule();
    const weigh = d.stages[1]!.steps[0]!;
    expect(sentenceText(d, block('weigh'), weigh.settings, sentence(block('weigh'), block('weigh').calcs[1]!)))
      .toBe('The net weight must be within ± 0.5 % of the batch quantity of Examplol, adjusted for the lot.');
  });

  it('every block reads in words with its default settings: a limit written in the block too, never [object Object]', () => {
    const d = capsule();
    for (const b of BLOCKS) {
      const t = stepFrom(b, []);
      const text = [stepText(d, t, 0), ...b.calcs.map((c) => sentenceText(d, b, t.settings, sentence(b, c)))].join(' ');
      expect(text, `${b.id} v${b.version}`).not.toMatch(/\[object Object\]|undefined|NaN/);
    }
    const band = block('capsule-band');
    expect(sentenceText(d, band, {}, sentence(band, band.calcs[2]!))).toBe('The leaking capsules found must be 0: none allowed.');
    // Any other shape written into a block reads in words too.
    const said = (limit: unknown) => sentenceText(d, band, {}, sentence(band, { name: 'x', label: 'x', template: 'C1', args: { value: '$leakers', limit } }));
    expect(said({ max: 0 })).toBe('The leaking capsules found must be at most 0.');
    expect(said({ low: '2', high: '5', unit: 'kg' })).toBe('The leaking capsules found must be within 2 to 5 kg.');
    expect(said([{ high: '$tempCheck', highStrict: true }, { min: 1 }])).toBe('The leaking capsules found must be less than the band solution temperature and at least 1.');
  });

  it('a quantity or limit is offered only from values of a compatible kind', () => {
    expect(neededKind(block('stage-yield'), 'theoretical')).toBe('mass');
    expect(neededKind(block('stage-yield'), 'yieldLimit')).toBe('fraction');
    expect(neededKind(block('softgel-dry'), 'hardnessLimit')).toBe('force');
    // A limit on a result whose template sets its kind: not the kind of the values it is worked out from.
    expect(['carrLimit', 'hausnerLimit', 'reposeLimit', 'finesLimit', 'recoveryLimit', 'rsdLimit', 'mixTimeLimit']
      .map((n) => neededKind(BLOCKS.find((b) => b.settings.some((x) => x.name === n))!, n)))
      .toEqual(['fraction', 'number', 'angle', 'fraction', 'fraction', 'fraction', 'time']);
    const masses = earlierRefs(capsule(), 3, 0).filter((r) => r.kind === 'mass').map((r) => r.ref);
    expect(masses).toContain('filling/fill/meanWeight');
    expect(masses).not.toContain('filling/yield/yield');
    // A later step, or a step inside another sub-batch stage, is never offered.
    expect(earlierRefs(capsule(), 2, 0).map((r) => r.ref).some((r) => r.startsWith('filling/') || r.startsWith('coating/'))).toBe(false);
  });

  it('worked examples run the engine on example values: the weighing meets its adjusted target, the yield is in limits', () => {
    const d = capsule();
    const api = workedExample(d, 1, 0);
    expect(api.results.target).toMatchObject({ ok: true, shown: expect.stringContaining('10.000 kg × 100 ÷ 98.505 % = 10.152 kg') });
    expect(api.results.netCheck).toMatchObject({ ok: true, check: { pass: true } });
    expect(workedExample(d, 1, 1).results.target).toMatchObject({ ok: true, shown: expect.stringContaining('11.848 kg Lactose monohydrate') });
    expect(workedExample(d, 3, 0).results.gain).toMatchObject({ ok: true, check: { pass: true } });
    expect(workedExample(d, 2, 1, { output: { value: '20.000', unit: 'kg' } }).results.yield).toMatchObject({ ok: true, check: { pass: false } });
  });

  it('TC-13 the calculation preview adjusts the API for the lot and compensates the filler', () => {
    const rows = dispensing(capsule(), { api: { assay: '98.0', lod: '2.0' } });
    expect(rows[0]!.adjusted).toMatchObject({ ok: true, value: expect.stringMatching(/^10\.41232/) });
    expect(rows[1]!.adjusted).toMatchObject({ ok: true, value: expect.stringMatching(/^11\.58767/) });
    expect(rows[2]!.adjusted).toBeUndefined();
  });

  it('TC-10 the process skeletons are valid drafts and start every stage with line clearance; what they leave open is listed by the master check', () => {
    const header = { productItemId: 'p', productCode: 'P', productName: 'P', batchSize: '100000', fillWeightMg: '250.0', shellType: 'hard gelatin' as const, shellSize: '1', shellWeightMg: '75.0', dispensingRooms: ['RM-101'] };
    const soft = { ...header, shellType: 'soft gelatin' as const, shellWeightMg: '300.0' };
    for (const s of SKELETON_LIST) {
      const h = s.id.startsWith('softgel') ? soft : header;
      const doc = masterSchema.parse({ header: h, formula: [], stages: skeletonStages(s.id, h) });
      expect(doc.stages.every((st) => st.steps[0]!.block.id === 'line-clearance' && st.steps.every((t) => findBlock(t.block)))).toBe(true);
      // Only what the author fills in: settings, the formula and the rooms of preparations and blending.
      expect(masterChecks(doc).filter((p) => p.level === 'error').every((p) => /not set|no fill materials|no empty shell line|no gel mass lines|choose the rooms/.test(p.message)), s.id).toBe(true);
    }
    expect(SKELETON_LIST.map((s) => s.id)).toEqual(['hard-direct-fill', 'hard-wet-granulation', 'softgel-oily', 'softgel-suspension', 'liquid-filled-hard']);
    const bare = masterSchema.parse({ header: { ...header, dispensingRooms: undefined }, formula: [], stages: skeletonStages(SKELETON_LIST[0]!.id, header) });
    expect(masterChecks(bare).filter((p) => p.path === 'header.dispensingRooms')).toEqual([{ level: 'error', path: 'header.dispensingRooms', rule: 'TC-11',
      message: 'The master weighs but names no dispensing rooms: choose them in the header (rooms of master data)' }]);
    const ids = (id: string, h: typeof header | typeof soft = header) => skeletonStages(id, h).map((s) => s.steps.map((t) => t.block.id).join(' '));
    expect(ids('hard-direct-fill')).toEqual(['line-clearance weigh sift dry-mix stage-yield',
      'line-clearance capsule-fill uniformity-by-weight disintegration polish-print metal-check capsule-reconciliation']);
    const df = skeletonStages('hard-direct-fill', header);
    // TC-15: rounds every 30 minutes on the gross weight: ± 5 % of 250.0 mg fill + 75.0 mg shell = 325.0 mg.
    expect(df[1]!.steps[1]).toMatchObject({ everyMinutes: 30, flow: { kind: 'repeat-until' }, settings: { meanLimit: { low: '308.8', high: '341.3', unit: 'mg' } } });
    expect(df[1]!.steps[2]!.settings.coating).toBe('hard capsule');
    expect(df[1]!.steps.at(-1)!.settings.meanWeight).toEqual({ ref: 'filling/fill/meanWeight' });
    expect(df.map((s) => s.roomTypes.join())).toEqual(['', 'Capsule filling']);
    expect(skeletonStages('hard-wet-granulation', header).map((s) => s.key)).toEqual(['binder', 'granulation', 'blending', 'filling']);
    expect(skeletonStages('hard-wet-granulation', header)[2]!.steps.find((t) => t.key === 'yield')!.settings.theoretical).toEqual({ header: 'fillBatch' });
    // Soft gel: gel mass and fill medicine alongside; the fills against ± 3 % of the fill target; drying twice, to a hardness.
    expect(ids('softgel-oily', soft)).toEqual(['line-clearance weigh charge gel-mass', 'line-clearance weigh charge mix check',
      'line-clearance softgel-encapsulate softgel-dry softgel-dry polish-print uniformity-by-weight disintegration qa-sample capsule-reconciliation']);
    const sg = skeletonStages('softgel-oily', soft);
    expect(sg.map((s) => s.kind)).toEqual(['preparation', 'preparation', 'normal']);
    expect(sg[2]!.steps[1]!.settings).toMatchObject({ fillTarget: { header: 'fillWeight' }, meanLimit: { low: '242.5', high: '257.5', unit: 'mg' } });
    expect(sg[2]!.steps.filter((t) => t.block.id === 'softgel-dry').map((t) => [t.name, t.minMinutes, t.flow.kind])).toEqual([['Tumble drying', 120, 'repeat-until'], ['Tray drying', 2880, 'repeat-until']]);
    expect(sg[2]!.steps[5]!.settings.coating).toBe('soft capsule, solution fill');
    // A suspension fill is milled and deaerated, and uses content uniformity.
    expect(ids('softgel-suspension', soft)[1]).toBe('line-clearance weigh charge mix sieve mix check');
    expect(skeletonStages('softgel-suspension', soft)[2]!.steps[5]).toMatchObject({ block: { id: 'content-uniformity' }, settings: { coating: 'soft capsule, suspension fill' } });
    expect(ids('liquid-filled-hard')[1]).toBe('line-clearance capsule-fill capsule-band uniformity-by-weight disintegration polish-print capsule-reconciliation');
  });

  it('a weigh step added from the library starts with the usual tolerance', () => {
    expect(stepFrom(block('weigh'), []).settings).toEqual({ tolerance: '0.5' });
    expect(stepFrom(block('sift'), []).settings).toEqual({});
  });

  it('copy to a new batch size scales typed batch quantities, not limits or quantities per capsule', () => {
    const d = scaleDoc(capsule(), '50000');
    expect(d.header.batchSize).toBe('50000');
    expect(d.stages[1]!.steps[6]!.settings.theoretical).toBe('11.500 kg');
    expect(d.stages[1]!.steps[6]!.settings.yieldLimit).toEqual({ low: '97.0', high: '100.5', unit: '%' });
    expect(d.formula[0]!.mgPerCapsule).toBe('100.0');
  });

  it('the changes view shows what changed, was added or removed since the previous version', () => {
    const prev = capsule();
    const next = capsule();
    next.formula[4]!.mgPerCapsule = '18.0';
    next.stages[2]!.steps.pop();
    next.stages[1]!.produces!.holdHours = 48;
    const diff = diffMasters(prev, next);
    const lines = diff.flatMap((s) => s.lines.filter((l) => l.change !== 'same').map((l) => `${s.title} ${l.key} ${l.change}`));
    expect(lines).toEqual(['Formula mcc changed', 'Stage 2: Granulation about changed', 'Stage 3: Filling yield removed']);
    expect(describeMaster(prev).map((s) => s.title)).toEqual(['Header', 'Formula', 'Stage 1: Binder solution', 'Stage 2: Granulation', 'Stage 3: Filling', 'Stage 4: Coating']);
  });

  it('TC-P1 a packing master reads in packing words: the pack and its packing materials, no formula and no coating', () => {
    const [top, materials] = describeMaster(packing());
    expect([top!.title, materials!.title]).toEqual(['Pack', 'Packing materials']);
    const text = [top, materials].flatMap((s) => s!.lines.map((l) => l.text)).join(' ');
    expect(text).not.toMatch(/formula|uncoated|coated weight/i);
    expect(text).toMatch(/Blister of 10 capsules; \d+ packs per carton\./);
    expect(materials!.lines.length).toBe(packing().pack!.materials.length);
  });

  it('TC-P1 the plain view names a step\'s packing material by its name and code, and a count in master data\'s unit (nos), as the floor does', () => {
    const units = new Map([['pm-foil', 'm'], ['pm-ctn', 'nos']]);
    const sections = describeMaster(packing(), units);
    const all = sections.flatMap((s) => s.lines.map((l) => l.text)).join(' ');
    expect(all).not.toMatch(/the batch quantity of/);
    expect(sections[1]!.lines.find((l) => l.key === 'carton')!.text).toBe('Carton (PM-103), carton: 1 carton per 10 packs; printed, issued with a second person and reconciled; coded with the batch details.');
    // Without master data, as the master has it; a material master data counts in another unit keeps the master's.
    expect(describeMaster(packing()).flatMap((s) => s.lines).find((l) => l.key === 'carton')!.text).toMatch(/: 1 carton per 10 packs/);
    expect(all).toMatch(/Leaflet \(PM-104\), leaflet: 1 leaflet per 10 packs/);
    // A count used once or more per pack, or a length, per pack (17 Nov 2026 run, F6).
    expect(all).toMatch(/Printed aluminium foil \(PM-101\), foil: 0\.120 m per pack/);
    expect(perPackText({ perPack: '0.002', unit: 'units', kind: 'shipper' })).toBe('1 shipper per 500 packs');
    expect(perPackText({ perPack: '2', unit: 'units', kind: 'desiccant' }, 'nos')).toBe('2 nos per pack');
    expect(perPackText({ perPack: '0.3', unit: 'units', kind: 'other' }, 'nos')).toBe('0.3 nos per pack');
    const steps = sections.flatMap((s) => s.lines).filter((l) => /^\d+\. (Issue|Reconcile) /.test(l.text)).map((l) => l.text);
    expect(steps.find((x) => /^\d+\. Issue Carton \(PM-103\): /.test(x))).toMatch(/Packing material: Carton \(PM-103\)\. Unit: nos\./);
    expect(steps.find((x) => /^\d+\. Reconcile Printed aluminium foil \(PM-101\): /.test(x))).toMatch(/Printed material: Printed aluminium foil \(PM-101\)\. Unit: m\./);
  });

  it('the plain view titles each step as the floor does and never shows a step\'s internal key', () => {
    const d = packing();
    const all = d.stages.flatMap((s) => s.steps);
    d.stages[1]!.steps[2]!.orderAfter = d.stages[1]!.steps[1]!.key;
    const lines = describeMaster(d).filter((s) => s.key.startsWith('stage:')).flatMap((s) => s.lines.filter((l) => l.key !== 'about'));
    expect(lines.map((l) => /^\d+\. ([^:]+):/.exec(l.text)?.[1])).toEqual(d.stages.flatMap((s) => s.steps.map((t) => stepTitle(d, t))));
    for (const l of lines) for (const t of all) expect(l.text, l.key).not.toContain(`(${t.key})`);
    expect(lines.map((l) => l.text).filter((x) => /Order-critical/.test(x)).map((x) => /Order-critical: [^.]*\.[^.]*\./.exec(x)![0]))
      .toEqual([`Order-critical: after step 2. ${stepTitle(d, d.stages[1]!.steps[1]!)}.`]);
    expect(lines.map((l) => /^\d+\. Issue [^:]+/.exec(l.text)?.[0]).filter(Boolean)).toEqual(['2. Issue Printed aluminium foil (PM-101)', '3. Issue PVC/PVDC film (PM-102)', '4. Issue Carton (PM-103)', '5. Issue Leaflet (PM-104)']);
  });

  it('calculation checks: the author answers a warning; the answer is kept in the master and shown in the review and changes views', () => {
    const prev = capsule();
    prev.formula[0]!.name = 'Examplol hydrochloride';
    const warning = masterChecks(prev).find((p) => p.question?.key === 'label-basis/api')!;
    expect(blocking(warning)).toBe(true);
    expect(describeMaster(prev).at(-1)).toMatchObject({ title: 'Calculation checks', lines: [{ text: expect.stringMatching(/Not answered yet\.$/) }] });
    const next = answerDoc(prev, warning, 'as Examplol hydrochloride', 'The label for this market states the salt');
    expect(next.answers).toEqual({ 'label-basis/api': { about: warning.message, choice: 'as Examplol hydrochloride', reason: 'The label for this market states the salt' } });
    expect(masterSchema.parse(next).answers).toEqual(next.answers);
    expect(unplaced(masterChecks(next).filter(blocking))).toEqual([]);
    const line = describeMaster(next).at(-1)!.lines[0]!.text;
    expect(line).toMatch(/^Formula › Examplol hydrochloride: Label claim .* Answered: as Examplol hydrochloride\. Reason: The label for this market states the salt\.$/);
    expect(diffMasters(prev, next).flatMap((s) => s.lines.filter((l) => l.change !== 'same').map((l) => `${s.title} ${l.change}: ${l.text}`))).toEqual([`Calculation checks changed: ${line}`]);
    // A changed item asks again: the answer was for the warning as it read then.
    const changed = { ...next, formula: next.formula.map((l, i) => (i === 0 ? { ...l, mgPerCapsule: '90.0' } : l)) };
    expect(masterChecks(changed).find((p) => p.question?.key === 'label-basis/api')?.question?.answer).toBeUndefined();
  });
});
