import type { Block } from './format.js';

// Hard capsule filling with periodic in-process checks (TC-15): a round every N minutes (the master sets it, at most 30,
// a product choice) until filling is finished. Each round: 20 filled-capsule weights on the gross weight (T7 mean, C3
// each against ± % of the mean; the master's mean limits are the fill target + the mean empty shell), the closed length
// of 5 capsules, locking and dents seen (C4) and the capsules rejected. The shell lot is picked when the shells are weighed (TC-12).
export const capsuleFill: Block = {
  id: 'capsule-fill', version: 1, name: 'Fill capsules with periodic checks', checker: false, stop: 'finished',
  periodic: { maxMinutes: 30 },
  instruction: 'Take 20 filled capsules and record their weights, then the closed length of 5 capsules. Look at the capsules: closed and locked, no dents or splits.',
  fields: [
    { name: 'machine', label: 'Capsule filling machine', kind: 'machine', types: ['capsule fill', 'capsule filler', 'filling machine', 'encapsulat'], notTypes: ['soft', 'liquid filling', 'vial', 'ampoule', 'bottle'] },
    { name: 'weights', label: 'Weights of 20 filled capsules', kind: 'number', unit: 'mg', count: 20 },
    { name: 'length', label: 'Closed length of 5 capsules', kind: 'number', unit: 'mm', count: 5 },
    { name: 'appearance', label: 'Capsules closed and locked, no dents or splits', kind: 'yes-no' },
    { name: 'rejected', label: 'Capsules rejected since the last round', kind: 'number', unit: 'capsules' },
    { name: 'fillingDone', label: 'Filling finished', kind: 'yes-no' },
  ],
  settings: [
    { name: 'meanLimit', label: 'Mean filled-capsule weight limits', kind: 'limit' },
    { name: 'weightBand', label: 'Individual weights (± % of the mean)', kind: 'number' },
    { name: 'weightOuterBand', label: 'No capsule outside (± % of the mean)', kind: 'number' },
    { name: 'lengthLimit', label: 'Closed length limits', kind: 'limit', optional: true },
  ],
  calcs: [
    { name: 'meanWeight', label: 'Mean filled-capsule weight', template: 'T7', args: { readings: '$weights', limit: '$meanLimit' } },
    { name: 'individualWeights', label: 'Individual weights', template: 'C3', args: { readings: '$weights', band: { plusMinusPercent: '$weightBand', of: 'mean' }, allowedOutside: 2, outer: { plusMinusPercent: '$weightOuterBand', of: 'mean' }, noun: 'capsules', meanLimit: '$meanLimit' } },
    { name: 'lengthCheck', label: 'Closed length', template: 'C3', args: { readings: '$length', band: { limit: '$lengthLimit' }, noun: 'capsules' } },
    { name: 'appearanceCheck', label: 'Closed, locked, no dents', template: 'C4', args: { question: 'Capsules closed and locked, no dents or splits', answers: ['$appearance'], expected: ['yes'] } },
    { name: 'finished', label: 'Filling finished', template: 'C4', args: { question: 'Filling finished', answers: ['$fillingDone'], expected: ['yes'] } },
  ],
};
