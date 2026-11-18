import type { Block } from './format.js';

// Metal detector challenge (optional in a master, owner 18 Nov 2026): at the start, at the master's interval and at the
// end, each test piece (iron, non-iron, stainless steel, sizes from the master) is detected and rejected (C4); the
// capsules rejected by the detector are counted.
export const metalCheck: Block = {
  id: 'metal-check', version: 1, name: 'Metal detector challenge', checker: false, stop: 'finished',
  periodic: { maxMinutes: 120 },
  instruction: 'Pass each test piece through the metal detector with capsules. Each must be detected and rejected. Count the capsules the detector rejected since the last check.',
  fields: [
    { name: 'machine', label: 'Metal detector', kind: 'machine', types: ['metal'] },
    { name: 'fe', label: 'Iron test piece detected and rejected', kind: 'yes-no' },
    { name: 'nonFe', label: 'Non-iron test piece detected and rejected', kind: 'yes-no' },
    { name: 'ss', label: 'Stainless steel test piece detected and rejected', kind: 'yes-no' },
    { name: 'rejected', label: 'Capsules rejected by the detector since the last check', kind: 'number', unit: 'capsules' },
    { name: 'runDone', label: 'Run finished (this is the end check)', kind: 'yes-no' },
  ],
  settings: [
    { name: 'feSize', label: 'Iron test piece (mm)', kind: 'text' },
    { name: 'nonFeSize', label: 'Non-iron test piece (mm)', kind: 'text' },
    { name: 'ssSize', label: 'Stainless steel test piece (mm)', kind: 'text' },
  ],
  calcs: [
    { name: 'challenge', label: 'Test pieces detected and rejected', template: 'C4', args: { question: 'Each test piece detected and rejected', answers: ['$fe', '$nonFe', '$ss'], expected: ['yes'] } },
    { name: 'finished', label: 'Run finished', template: 'C4', args: { question: 'Run finished', answers: ['$runDone'], expected: ['yes'] } },
  ],
};
