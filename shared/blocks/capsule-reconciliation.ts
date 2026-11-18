import type { Block } from './format.js';

// Copied from tablet-reconciliation (TC-18): the good and rejected capsules counted by weight (T6, ÷ the mean
// filled-capsule weight taken after the last weight-changing step), the yield in capsules (T3) and the accountability of
// every capsule (T4). A yield step: always checked (TC-08).
export const capsuleReconciliation: Block = {
  id: 'capsule-reconciliation', version: 1, name: 'Reconciliation of capsules', gmp: 'yield', checker: true,
  instruction: 'Weigh the good capsules and the rejected capsules. Count the capsules taken as samples (in-process and QC).',
  fields: [
    { name: 'output', label: 'Net weight of good capsules', kind: 'number', unit: 'kg' },
    { name: 'rejectWeight', label: 'Net weight of rejected capsules', kind: 'number', unit: 'kg' },
    { name: 'samples', label: 'Capsules taken as samples', kind: 'number', unit: 'capsules' },
  ],
  settings: [
    { name: 'theoretical', label: 'Theoretical number of capsules', kind: 'quantity' },
    { name: 'meanWeight', label: 'Mean filled-capsule weight (after the last weight-changing step)', kind: 'quantity' },
    { name: 'yieldLimit', label: 'Yield limits', kind: 'limit' },
    { name: 'accountabilityLimit', label: 'Accountability limits', kind: 'limit' },
  ],
  calcs: [
    { name: 'goodCapsules', label: 'Good capsules', template: 'T6', args: { mode: 'ratio', a: '$output', b: '$meanWeight', unit: 'capsules', decimals: 0 } },
    { name: 'rejects', label: 'Rejected capsules', template: 'T6', args: { mode: 'ratio', a: '$rejectWeight', b: '$meanWeight', unit: 'capsules', decimals: 0 } },
    { name: 'yield', label: 'Yield', template: 'T3', args: { actual: '$goodCapsules', theoretical: '$theoretical', limit: '$yieldLimit' } },
    { name: 'accountability', label: 'Accountability', template: 'T4', args: { input: '$theoretical', parts: [{ name: 'good capsules', value: '$goodCapsules' }, { name: 'samples', value: '$samples' }, { name: 'rejects', value: '$rejects' }], limit: '$accountabilityLimit' } },
  ],
};
