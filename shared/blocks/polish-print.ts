import type { Block } from './format.js';

// Polish or print the capsules: the result checked by eye (C4).
export const polishPrint: Block = {
  id: 'polish-print', version: 1, name: 'Polish or print', checker: false,
  instruction: 'Polish or print the capsules as shown. Check a sample: evenly polished, print legible, complete and in the right place, no smudges.',
  fields: [
    { name: 'machine', label: 'Coater or printer', kind: 'machine', types: ['coat', 'print', 'polish'] },
    { name: 'lot', label: 'Wax or ink lot', kind: 'lot' },
    { name: 'appearance', label: 'Polish even, print legible, complete and in place', kind: 'yes-no' },
  ],
  settings: [{ name: 'print', label: 'Polish or print (text, colour)', kind: 'text' }],
  calcs: [
    { name: 'appearanceCheck', label: 'Appearance', template: 'C4', args: { question: 'Polish even, print legible, complete and in place', answers: ['$appearance'], expected: ['yes'] } },
  ],
};
