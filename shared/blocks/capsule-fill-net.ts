import type { Block } from './format.js';

// Variant of capsule-fill (owner, 18 Nov 2026: variants are their own blocks): the fill weight on the NET contents, for
// shells whose weight varies too much for a gross check. Each of 10 capsules is weighed full, then emptied and weighed
// empty (T7 per capsule: full − empty); the mean against its limits (C1) and each fill against ± % of the fill target (C3).
const caps = Array.from({ length: 10 }, (_, i) => `c${i + 1}`);
export const capsuleFillNet: Block = {
  id: 'capsule-fill-net', version: 1, name: 'Fill capsules with periodic net fill checks', checker: false, stop: 'finished',
  periodic: { maxMinutes: 30 },
  instruction: 'Take 10 filled capsules. Weigh each capsule full, empty it, and weigh its empty shell. Look at the capsules: closed and locked, no dents or splits.',
  fields: [
    { name: 'machine', label: 'Capsule filling machine', kind: 'machine', types: ['capsule fill', 'capsule filler', 'filling machine', 'encapsulat'], notTypes: ['soft', 'liquid filling', 'vial', 'ampoule', 'bottle'] },
    ...caps.map((c, i) => ({ name: c, label: `Capsule ${i + 1}: full, then empty shell`, kind: 'number' as const, unit: 'mg', count: 2 })),
    { name: 'appearance', label: 'Capsules closed and locked, no dents or splits', kind: 'yes-no' },
    { name: 'rejected', label: 'Capsules rejected since the last round', kind: 'number', unit: 'capsules' },
    { name: 'fillingDone', label: 'Filling finished', kind: 'yes-no' },
  ],
  settings: [
    { name: 'fillTarget', label: 'Fill weight target', kind: 'quantity', notBatch: 'tablet' },
    { name: 'meanLimit', label: 'Mean fill weight limits', kind: 'limit' },
    { name: 'weightBand', label: 'Each fill (± % of the target)', kind: 'number' },
  ],
  calcs: [
    { name: 'meanFill', label: 'Mean fill weight', template: 'T7', args: { units: caps.map((c) => `$${c}`), combine: 'first minus rest', limit: '$meanLimit' } },
    { name: 'individualFills', label: 'Each fill weight', template: 'C3', args: { units: caps.map((c) => `$${c}`), combine: 'first minus rest', band: { plusMinusPercent: '$weightBand', of: { target: '$fillTarget' } }, noun: 'capsules' } },
    { name: 'appearanceCheck', label: 'Closed, locked, no dents', template: 'C4', args: { question: 'Capsules closed and locked, no dents or splits', answers: ['$appearance'], expected: ['yes'] } },
    { name: 'finished', label: 'Filling finished', template: 'C4', args: { question: 'Filling finished', answers: ['$fillingDone'], expected: ['yes'] } },
  ],
};
