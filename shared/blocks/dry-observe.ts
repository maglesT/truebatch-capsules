import type { Block } from './format.js';

// Variant of dry (owner, 18 Nov 2026: variants are their own blocks): heat until something is seen, e.g. the fill of
// powder-and-PEG capsules melted in the shell (C4). Repeat-until; the minimum time is the step's minimum time.
export const dryObserve: Block = {
  id: 'dry-observe', version: 1, name: 'Heat until an end point is seen', checker: false, stop: 'endCheck',
  instruction: 'Heat as shown, record the temperature, and look whether the end point shown is reached.',
  fields: [
    { name: 'machine', label: 'Oven or dryer', kind: 'machine', types: ['dryer', 'drier', 'oven'] },
    { name: 'temperature', label: 'Temperature', kind: 'number', unit: '°C' },
    { name: 'reached', label: 'End point reached', kind: 'yes-no' },
  ],
  settings: [
    { name: 'endPoint', label: 'End point (what is seen)', kind: 'text' },
    { name: 'tempLimit', label: 'Temperature limits', kind: 'limit' },
  ],
  calcs: [
    { name: 'tempCheck', label: 'Temperature', template: 'C1', args: { value: '$temperature', limit: '$tempLimit' } },
    { name: 'endCheck', label: 'End point', template: 'C4', args: { question: 'End point reached', answers: ['$reached'], expected: ['yes'] } },
  ],
};
