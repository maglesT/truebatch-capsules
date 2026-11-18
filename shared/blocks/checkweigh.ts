import type { Block } from './format.js';

// Variant of polish-print for sorting by weight (owner, 18 Nov 2026: variants are their own blocks): a 100 % checkweigher.
// At the start, the master's interval and the end: the set limits within the master's (C1), the over- and under-weight
// challenge capsules rejected (C4), and the capsules rejected since the last check counted.
export const checkweigh: Block = {
  id: 'checkweigh', version: 1, name: 'Sort capsules on a checkweigher', checker: false, stop: 'finished',
  periodic: { maxMinutes: 120 },
  instruction: 'Record the low and high set limits of the checkweigher. Pass the over-weight and under-weight challenge capsules: both must be rejected. Count the capsules rejected since the last check.',
  fields: [
    { name: 'machine', label: 'Checkweigher', kind: 'machine', types: ['checkweigh', 'weight sort'] },
    { name: 'setLow', label: 'Low set limit', kind: 'number', unit: 'mg' },
    { name: 'setHigh', label: 'High set limit', kind: 'number', unit: 'mg' },
    { name: 'over', label: 'Over-weight challenge capsule rejected', kind: 'yes-no' },
    { name: 'under', label: 'Under-weight challenge capsule rejected', kind: 'yes-no' },
    { name: 'rejected', label: 'Capsules rejected since the last check', kind: 'number', unit: 'capsules' },
    { name: 'runDone', label: 'Sorting finished (this is the end check)', kind: 'yes-no' },
  ],
  settings: [{ name: 'weightLimit', label: 'Filled-capsule weight limits (the set limits must be inside)', kind: 'limit' }],
  calcs: [
    { name: 'lowCheck', label: 'Low set limit', template: 'C1', args: { value: '$setLow', limit: '$weightLimit' } },
    { name: 'highCheck', label: 'High set limit', template: 'C1', args: { value: '$setHigh', limit: '$weightLimit' } },
    { name: 'challenge', label: 'Challenge capsules rejected', template: 'C4', args: { question: 'Challenge capsule rejected', answers: ['$over', '$under'], expected: ['yes'] } },
    { name: 'finished', label: 'Sorting finished', template: 'C4', args: { question: 'Sorting finished', answers: ['$runDone'], expected: ['yes'] } },
  ],
};
