import type { Block } from './format.js';

// Polish, print or sort the capsules (polisher, printer, sorter or inspection belt): the result checked by eye (C4) and
// the capsules rejected counted.
export const polishPrint: Block = {
  id: 'polish-print', version: 1, name: 'Polish, print or sort', checker: false,
  instruction: 'Polish, print or sort the capsules as shown and count the capsules rejected. Check a sample: clean and evenly polished, print (if any) legible, complete and in place, no damaged capsules.',
  fields: [
    { name: 'machine', label: 'Polisher, printer or sorter', kind: 'machine', types: ['print', 'polish', 'sort', 'inspect', 'dedust'] },
    { name: 'lot', label: 'Ink lot (printed capsules)', kind: 'lot', optional: true },
    { name: 'rejected', label: 'Capsules rejected', kind: 'number', unit: 'capsules' },
    { name: 'appearance', label: 'Capsules clean, print (if any) legible and in place, none damaged', kind: 'yes-no' },
  ],
  settings: [{ name: 'print', label: 'What is done (polish, print text and colour, or sort)', kind: 'text' }],
  calcs: [
    { name: 'appearanceCheck', label: 'Appearance', template: 'C4', args: { question: 'Capsules clean, print (if any) legible and in place, none damaged', answers: ['$appearance'], expected: ['yes'] } },
  ],
};
