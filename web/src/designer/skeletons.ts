// Process skeletons a new master may start from: the usual stages and steps of a process, as data. Settings that
// depend on the product (which material a step weighs, its limits) are left for the author; the master check lists
// them. Fill-weight limits start at ± 5 % of the filled capsule (fill + mean empty shell). Every stage is worked in a
// room, so each starts with line clearance (TC-10). A later stage's yield is on the actual input of the stage (the
// previous stage's output), unless the stage adds materials (blending: on the fill batch weight); the capsules are
// reconciled by weight with the mean filled-capsule weight, and the granulation end point is checked by a second
// person. A new master names no dispensing rooms: the author picks them (Header.tsx). A stage starts with the rooms it
// usually runs in, by the demo's area names (filling, then polishing and sorting in an inspection room); a stage whose rooms differ from plant to plant (a binder solution, a
// preparation, blending) is left for the author: the master check asks for its rooms (TC-11).
import { findBlock } from '../../../shared/blocks/index.js';
import { Dec } from '../../../shared/templates/index.js';
import type { MasterDoc, Pack, SettingValue, Stage, Step } from '../../../shared/master/schema.js';
import { stepFrom } from './model.js';

type Header = MasterDoc['header'];
interface StepPlan { block: string; key?: string; name?: string; checker?: boolean; settings?: (h: Header) => Record<string, SettingValue>; minMinutes?: number }
interface StagePlan { key: string; name: string; kind?: Stage['kind']; role: string; rooms?: string[]; produces?: [string, number]; uses?: string[]; steps: StepPlan[] }

const pct = (h: Header, mg: string, by: string) => new Dec(mg).times(new Dec(100).plus(by)).div(100).toFixed(1);
const yieldStep = (theoretical: SettingValue): StepPlan => ({ block: 'stage-yield', key: 'yield', settings: () => ({
  theoretical, yieldLimit: { low: '97.0', high: '100.5', unit: '%' }, accountabilityLimit: { low: '99.0', high: '100.5', unit: '%' } }) });
const weighStep = (key: string): StepPlan => ({ block: 'weigh', key });
// TC-15: fill weights are checked in rounds while filling (gross: ± 5 % of fill + mean empty shell to start with), then
// the capsule tests, sorting, the optional metal check (owner, 18 Nov 2026), and the capsules reconciled at the end.
const gross = (h: Header) => (h.shellWeightMg ? new Dec(h.fillWeightMg || '0').plus(h.shellWeightMg).toString() : h.fillWeightMg);
const fillStep: StepPlan = { block: 'capsule-fill', key: 'fill', settings: (h) => ({
  meanLimit: { low: pct(h, gross(h), '-5'), high: pct(h, gross(h), '5'), unit: 'mg' }, weightBand: '7.5', weightOuterBand: '15.0' }) };
const reconcile = (stage: string, mean: string): StepPlan => ({ block: 'capsule-reconciliation', key: 'yield', settings: () => ({ theoretical: { header: 'batchSize' },
  meanWeight: { ref: `${stage}/${mean}/meanWeight` }, yieldLimit: { low: '97.0', high: '100.5', unit: '%' }, accountabilityLimit: { low: '99.0', high: '100.5', unit: '%' } }) });
const sortStep: StepPlan = { block: 'polish-print', key: 'sort', name: 'Polish and sort', settings: () => ({ print: 'polish and sort' }) };
const metalStep: StepPlan = { block: 'metal-check', key: 'metal' };
const hardTests = (unit: string): StepPlan[] => [{ block: 'uniformity-by-weight', settings: () => ({ coating: unit }) },
  { block: 'disintegration', settings: () => ({ maxTime: '30' }) }];
const filling = (uses: string[]): StagePlan => ({ key: 'filling', name: 'Filling', role: 'Filling operator', rooms: ['Capsule filling', 'Inspection'], produces: ['filled capsules', 720], uses,
  steps: [fillStep, ...hardTests('hard capsule'), sortStep, metalStep, reconcile('filling', 'fill')] });

// Wet granulation: binder solution, granulation and drying, blending with the extragranular materials and the
// lubricant. Blending adds materials to the granules, so its yield is on the theoretical fill batch weight (the
// granules' output alone would leave out what the stage adds and read above 100 %; the master check refuses it).
const WET: StagePlan[] = [
  { key: 'binder', name: 'Binder solution', kind: 'preparation', role: 'Granulation operator', produces: ['binder solution', 24],
    steps: [weighStep('weigh-binder'), { block: 'binder-solution' }] },
  { key: 'granulation', name: 'Granulation', role: 'Granulation operator', rooms: ['Granulation'], produces: ['dried granules', 72], uses: ['binder'],
    steps: [weighStep('weigh-api'), { block: 'sift' }, { block: 'charge', key: 'charge-api' }, { block: 'dry-mix' }, { block: 'granulate', checker: true }, { block: 'dry' },
      { block: 'sieve', key: 'mill' }, yieldStep('')] },
  { key: 'blending', name: 'Blending', role: 'Granulation operator', produces: ['lubricated blend', 72], uses: ['granulation'],
    steps: [{ block: 'lubricate', settings: () => ({ granuleWeight: { ref: 'granulation/yield/output' }, tolerance: '0.5' }) }, { block: 'blend-uniformity' }, yieldStep({ header: 'fillBatch' })] },
];
const BLEND: StagePlan = { key: 'blending', name: 'Blending', role: 'Production operator', produces: ['blend', 72],
  steps: [weighStep('weigh'), { block: 'sift' }, { block: 'dry-mix', key: 'blend' }, yieldStep({ header: 'fillBatch' })] };

// Soft gel: the gel mass and the fill medicine are made alongside (preparations with their hold times, TC-17); one stage
// encapsulates, dries (tumble, then tray for days: the minimum time), inspects and reconciles the capsules.
const gelMass: StagePlan = { key: 'gel-mass', name: 'Gel mass', kind: 'preparation', role: 'Gel mass operator', produces: ['gel mass', 48],
  steps: [weighStep('weigh-gel'), { block: 'charge', key: 'charge-gel' }, { block: 'gel-mass', minMinutes: 60 }] };
const fillMedicine = (suspension: boolean): StagePlan => ({ key: 'fill-medicine', name: 'Fill medicine', kind: 'preparation', role: 'Fill preparation operator', produces: ['fill medicine', 72],
  steps: [weighStep('weigh-fill'), { block: 'charge', key: 'charge-fill' }, { block: 'mix', minMinutes: 30 },
    ...(suspension ? [{ block: 'sieve', key: 'mill', name: 'Mill (colloid mill)' }, { block: 'mix', key: 'deaerate', name: 'Deaerate under vacuum', minMinutes: 30 }] : []),
    { block: 'check', key: 'viscosity', settings: () => ({ what: 'Viscosity of the fill medicine', unit: 'mPa·s' }) }] });
const softgel = (suspension: boolean): StagePlan => ({ key: 'encapsulation', name: 'Encapsulation, drying and inspection', role: 'Encapsulation operator',
  rooms: ['Softgel encapsulation', 'Softgel drying', 'Inspection'], produces: ['dried capsules', 720], uses: ['gel-mass', 'fill-medicine'],
  steps: [{ block: 'softgel-encapsulate', key: 'encapsulate', settings: (h) => ({ fillTarget: { header: 'fillWeight' },
    meanLimit: { low: pct(h, h.fillWeightMg, '-3'), high: pct(h, h.fillWeightMg, '3'), unit: 'mg' }, weightBand: '5.0' }) },
  { block: 'softgel-dry', key: 'tumble', name: 'Tumble drying', minMinutes: 120 }, { block: 'softgel-dry', key: 'tray', name: 'Tray drying', minMinutes: 2880 },
  // The dried capsules weigh less than fill + wet gel mass (the shell loses its water): their mean weight is measured
  // for the reconciliation by weight.
  { block: 'check', key: 'dried-weight', settings: () => ({ what: 'Mean weight of 20 dried capsules', unit: 'mg' }) },
  { ...sortStep, name: 'Inspect and sort' },
  suspension ? { block: 'content-uniformity', settings: () => ({ coating: 'soft capsule, suspension fill' }) } : { block: 'uniformity-by-weight', settings: () => ({ coating: 'soft capsule, solution fill' }) },
  { block: 'disintegration', settings: () => ({ maxTime: '30' }) }, { block: 'qa-sample' },
  { block: 'capsule-reconciliation', key: 'yield', settings: () => ({ theoretical: { header: 'batchSize' }, meanWeight: { ref: 'encapsulation/dried-weight/reading' },
    yieldLimit: { low: '95.0', high: '100.5', unit: '%' }, accountabilityLimit: { low: '99.0', high: '100.5', unit: '%' } }) }] });

const SKELETONS: { id: string; name: string; text: string; stages: StagePlan[] }[] = [
  {
    id: 'hard-direct-fill', name: 'Hard capsule, direct fill',
    text: 'Sifting and blending of the dispensed materials, then capsule filling (gelatin or HPMC shell) with fill-weight checks, tests and sorting.',
    stages: [BLEND, filling(['blending'])],
  },
  {
    id: 'hard-wet-granulation', name: 'Hard capsule, wet granulation',
    text: 'Binder solution, granulation and drying, lubrication, then capsule filling with fill-weight checks, tests and sorting.',
    stages: [...WET, filling(['blending'])],
  },
  {
    id: 'softgel-oily', name: 'Soft gel, oily solution fill',
    text: 'Gel mass and fill medicine made alongside, then encapsulation, tumble and tray drying, inspection and reconciliation.',
    stages: [gelMass, fillMedicine(false), softgel(false)],
  },
  {
    id: 'softgel-suspension', name: 'Soft gel, suspension fill',
    text: 'As the oily fill, with milling and deaeration of the fill medicine; content uniformity instead of weight variation.',
    stages: [gelMass, fillMedicine(true), softgel(true)],
  },
  {
    id: 'liquid-filled-hard', name: 'Liquid-filled hard capsule',
    text: 'Fill medicine, then capsule filling, banding or sealing, inspection and reconciliation.',
    stages: [fillMedicine(false), { key: 'filling', name: 'Filling and banding', role: 'Filling operator', rooms: ['Capsule filling', 'Inspection'], produces: ['filled capsules', 720], uses: ['fill-medicine'],
      steps: [fillStep, { block: 'capsule-band', key: 'band' }, ...hardTests('hard capsule'), sortStep, reconcile('filling', 'fill')] }],
  },
];
export const SKELETON_LIST = SKELETONS.map(({ id, name, text }) => ({ id, name, text }));

/** The stages of a skeleton for this header. */
export function skeletonStages(id: string, h: Header): Stage[] {
  const sk = SKELETONS.find((s) => s.id === id);
  if (!sk) return [];
  return sk.stages.map((p) => ({
    key: p.key, name: p.name, kind: p.kind ?? 'normal', roomTypes: p.rooms ?? [], machineTypes: [], role: p.role, uses: p.uses ?? [],
    ...(p.produces ? { produces: { name: p.produces[0], holdHours: p.produces[1] } } : {}),
    steps: [{ block: 'line-clearance' }, ...p.steps].reduce<Step[]>((steps, sp) => {
      const block = findBlock({ id: sp.block, version: 1 })!;
      const base = stepFrom(block, steps.map((t) => t.key));
      const settings = Object.fromEntries(Object.entries({ ...base.settings, ...sp.settings?.(h) }).filter(([, v]) => v !== ''));
      return [...steps, { ...base, ...(sp.key ? { key: sp.key } : {}), ...(sp.name ? { name: sp.name } : {}), settings,
        ...(sp.checker ? { checker: true } : {}), ...(sp.minMinutes ? { minMinutes: sp.minMinutes } : {}) }];
    }, []),
  }));
}

// TrueBatch Capsules Packing: the packing record for a pack and its materials. Issue to the line (the bulk capsules and
// each packing material); packing (line clearance, set-up, the camera and serial numbers when serialisation is
// checked, then the periodic checks alongside the line); and the end (finished goods and capsules, every printed
// material, the serial numbers, destruction of coded leftovers, line clearance after). Limits that depend on the
// product (sealing temperature, vacuum) are left for the author; the master check lists them.
const packStep = (block: string, key?: string, settings: Record<string, SettingValue> = {}): Step => {
  const b = findBlock({ id: block, version: 1 })!;
  return { ...stepFrom(b, []), ...(key ? { key } : {}), settings, ...(b.stop ? { flow: { kind: 'repeat-until' as const, maxRounds: 100 } } : {}) };
};
const issueStep = (m: Pack['materials'][number]) => packStep('pack-material-issue', `issue-${m.key}`, { material: { formula: m.key }, unit: m.unit });
const reconcileStep = (m: Pack['materials'][number]) => packStep('printed-reconciliation', `reconcile-${m.key}`, { material: { formula: m.key }, unit: m.unit, issued: { ref: `issue/issue-${m.key}/issued` } });
const packStage = (key: string, name: string, role: string, steps: Step[], roomTypes: string[] = []): Stage => ({ key, name, kind: 'normal', roomTypes, machineTypes: [], role, uses: [], steps });

export function packingStages(pack: Pack): Stage[] {
  const blister = pack.type !== 'bottle';
  const serial = pack.serialisation;
  return [
    packStage('issue', 'Issue to the line', 'Packing operator', [packStep('bulk-issue', 'bulk'), ...pack.materials.map(issueStep)]),
    packStage('packing', 'Packing', 'Packing operator', [packStep('pack-clearance', 'clearance'), packStep('line-setup', 'setup'),
      ...(serial ? [packStep('vision-challenge', 'camera'), packStep('serial-received', 'serials')] : []), packStep('coding-check', 'coding'),
      ...(blister ? [packStep('forming-check', 'forming'), packStep('leak-test', 'leak', { vacuumUnit: 'mbar', level: 'S-2', aql: '0.65' })] : []),
      packStep('online-inspection', 'inspection'), packStep('carton-check', 'cartons'), ...(serial ? [packStep('serial-sample', 'serial-sample')] : [])], ['Packing']),
    packStage('end', 'Reconciliation and line clearance', 'Packing supervisor', [
      packStep('finished-goods', 'finished', { meanWeight: { header: 'fillWeight' }, yieldLimit: { low: '98.0', high: '100.5', unit: '%' }, accountabilityLimit: { low: '99.5', high: '100.5', unit: '%' } }),
      ...pack.materials.filter((m) => m.printed).map(reconcileStep),
      ...(serial ? [packStep('serial-reconciliation', 'serial-reconciliation', { received: { ref: 'packing/serials/received' } })] : []),
      packStep('destruction'), packStep('pack-clearance-after', 'clearance-after')], ['Packing']),
  ];
}

/** Adds the issue and reconciliation steps of packing materials that have none (to the first and last stages). */
export function withMaterialSteps(doc: MasterDoc): MasterDoc {
  const p = doc.pack;
  const first = doc.stages[0];
  const last = doc.stages.at(-1);
  if (!p || !first || !last) return doc;
  const names = (s: Stage, block: string) => s.steps.filter((t) => t.block.id === block).map((t) => (t.settings.material as { formula?: string } | undefined)?.formula);
  const issue = p.materials.filter((m) => !names(first, 'pack-material-issue').includes(m.key)).map(issueStep);
  const recon = p.materials.filter((m) => m.printed && !names(last, 'printed-reconciliation').includes(m.key)).map(reconcileStep);
  const at = Math.max(0, last.steps.findIndex((t) => t.block.id === 'destruction' || t.block.id === 'pack-clearance-after'));
  const stages = doc.stages.map((s, i) => ({ ...s, steps: [...s.steps] }));
  stages[0]!.steps.push(...issue);
  stages.at(-1)!.steps.splice(at, 0, ...recon);
  return { ...doc, stages };
}
