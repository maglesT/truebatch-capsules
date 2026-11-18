import type { Block } from './format.js';

// Soft gel encapsulation with periodic checks (TC-15): ribbon thickness left and right and the wedge temperature (C1);
// 10 capsules each weighed whole and as a washed shell (T7 per capsule: capsule − washed shell = fill), the mean fill
// against its limits and each against ± % of the fill target (C3); the seal thickness (C1); leakers seen (C4).
const caps = Array.from({ length: 10 }, (_, i) => `c${i + 1}`);
export const softgelEncapsulate: Block = {
  id: 'softgel-encapsulate', version: 1, name: 'Encapsulate soft gels with periodic checks', checker: false, stop: 'finished',
  periodic: { maxMinutes: 30 },
  instruction: 'Record the ribbon thickness on both sides and the wedge temperature. Take 10 capsules: weigh each, cut it open, wash out the fill and weigh the dry shell. Measure the seal thickness and look for leakers.',
  fields: [
    { name: 'machine', label: 'Encapsulation machine', kind: 'machine', types: ['encapsulat', 'softgel', 'soft gel'], notTypes: ['inspect'] },
    { name: 'ribbonLeft', label: 'Ribbon thickness, left', kind: 'number', unit: 'mm' },
    { name: 'ribbonRight', label: 'Ribbon thickness, right', kind: 'number', unit: 'mm' },
    { name: 'wedgeTemp', label: 'Wedge temperature', kind: 'number', unit: '°C' },
    ...caps.map((c, i) => ({ name: c, label: `Capsule ${i + 1}: whole, then washed shell`, kind: 'number' as const, unit: 'mg', count: 2 })),
    { name: 'seal', label: 'Seal thickness', kind: 'number', unit: 'mm' },
    { name: 'noLeakers', label: 'No leaking or misshapen capsules seen', kind: 'yes-no' },
    { name: 'rejected', label: 'Capsules rejected since the last round', kind: 'number', unit: 'capsules' },
    { name: 'encapsulationDone', label: 'Encapsulation finished', kind: 'yes-no' },
  ],
  settings: [
    { name: 'ribbonLimit', label: 'Ribbon thickness limits', kind: 'limit' },
    { name: 'wedgeLimit', label: 'Wedge temperature limits', kind: 'limit' },
    { name: 'fillTarget', label: 'Fill weight target', kind: 'quantity' },
    { name: 'meanLimit', label: 'Mean fill weight limits', kind: 'limit' },
    { name: 'weightBand', label: 'Each fill (± % of the target)', kind: 'number' },
    { name: 'sealLimit', label: 'Seal thickness limits', kind: 'limit' },
  ],
  calcs: [
    { name: 'ribbonLeftCheck', label: 'Ribbon thickness, left', template: 'C1', args: { value: '$ribbonLeft', limit: '$ribbonLimit' } },
    { name: 'ribbonRightCheck', label: 'Ribbon thickness, right', template: 'C1', args: { value: '$ribbonRight', limit: '$ribbonLimit' } },
    { name: 'wedgeCheck', label: 'Wedge temperature', template: 'C1', args: { value: '$wedgeTemp', limit: '$wedgeLimit' } },
    { name: 'meanFill', label: 'Mean fill weight', template: 'T7', args: { units: caps.map((c) => `$${c}`), combine: 'first minus rest', limit: '$meanLimit' } },
    { name: 'individualFills', label: 'Each fill weight', template: 'C3', args: { units: caps.map((c) => `$${c}`), combine: 'first minus rest', band: { plusMinusPercent: '$weightBand', of: { target: '$fillTarget' } }, noun: 'capsules' } },
    { name: 'sealCheck', label: 'Seal thickness', template: 'C1', args: { value: '$seal', limit: '$sealLimit' } },
    { name: 'leakCheck', label: 'No leakers', template: 'C4', args: { question: 'No leaking or misshapen capsules seen', answers: ['$noLeakers'], expected: ['yes'] } },
    { name: 'finished', label: 'Encapsulation finished', template: 'C4', args: { question: 'Encapsulation finished', answers: ['$encapsulationDone'], expected: ['yes'] } },
  ],
};
