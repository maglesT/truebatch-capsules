import type { Block } from './format.js';

// Content uniformity of individual units in stages (C6, with the T14 acceptance value): 10 units, then 20 more when
// the first 10 do not pass. Round 42: an in-process test of the QC lab, picked from LIMS (the step's lab request). LIMS
// keeps one result with every value in order: 10 after the first stage, 30 after the second (the first 10, then the 20
// more); its reported figure is the acceptance value, worked out again here.
export const contentUniformity: Block = {
  id: 'content-uniformity', version: 1, name: 'Content uniformity sampling', checker: true,
  instruction: 'Take the capsules for content uniformity as the sampling plan says, label them and send them to QC. Pick the content of each capsule from QLIMS once QC has approved it; if the first 10 do not pass and QC tested 20 more, pick those too (typed from the QC report only while QLIMS cannot be reached).',
  fields: [
    { name: 'results', label: 'Content of 10 capsules (% of label claim)', kind: 'number', unit: '%', count: 10, qc: 'in_process', figure: 'AV', nextStage: 'moreResults' },
    { name: 'moreResults', label: 'Content of 20 more capsules (% of label claim)', kind: 'number', unit: '%', count: 20, optional: true, qc: 'in_process', figure: 'AV' },
  ],
  settings: [{ name: 'coating', label: 'Dosage unit', kind: 'text', options: ['hard capsule', 'soft capsule, solution fill', 'soft capsule, suspension fill'] }],
  calcs: [
    { name: 'acceptance', label: 'Content uniformity', template: 'C6', args: { test: 'content uniformity', coating: '$coating', stages: ['$results', '$moreResults?'] } },
  ],
};
