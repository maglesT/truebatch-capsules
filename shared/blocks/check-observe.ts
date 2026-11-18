import type { Block } from './format.js';

// Variant of check (owner, 18 Nov 2026: variants are their own blocks): an observation instead of a value, e.g.
// "solution clear", "suspension homogeneous", "worked under yellow light" (C4).
export const checkObserve: Block = {
  id: 'check-observe', version: 1, name: 'Check by observation', checker: false,
  instruction: 'Look and answer the question shown.',
  fields: [{ name: 'answer', label: 'Answer', kind: 'yes-no' }],
  settings: [{ name: 'what', label: 'What is seen (the question, answered yes when right)', kind: 'text' }],
  calcs: [{ name: 'answerCheck', label: 'Observation', template: 'C4', args: { question: 'What is seen is as it should be', answers: ['$answer'], expected: ['yes'] } }],
};
