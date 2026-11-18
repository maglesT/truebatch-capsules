import type { Block } from './format.js';

// Content uniformity of individual units in stages (C6, with the T14 acceptance value): 10 units, then 20 more when
// the first 10 do not pass.
export const contentUniformity: Block = {
  id: 'content-uniformity', version: 1, name: 'Content uniformity sampling', checker: true,
  instruction: 'Take the capsules for content uniformity as the sampling plan says, label them and send them to QC. Record the content of each capsule from the QC report; if QC tested 20 more, record those too.',
  fields: [
    { name: 'results', label: 'Content of 10 capsules (% of label claim)', kind: 'number', unit: '%', count: 10 },
    { name: 'moreResults', label: 'Content of 20 more capsules (% of label claim)', kind: 'number', unit: '%', count: 20, optional: true },
  ],
  settings: [{ name: 'coating', label: 'Dosage unit', kind: 'text', options: ['hard capsule', 'soft capsule, solution fill', 'soft capsule, suspension fill'] }],
  calcs: [
    { name: 'acceptance', label: 'Content uniformity', template: 'C6', args: { test: 'content uniformity', coating: '$coating', stages: ['$results', '$moreResults?'] } },
  ],
};
