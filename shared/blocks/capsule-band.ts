import type { Block } from './format.js';

// Banding or sealing of two-piece hard capsules, with periodic checks (TC-24 for US OTC products; liquid-filled
// capsules): the band temperature (C1), the band seen whole and even (C4) and the leakers found (none allowed, C1).
export const capsuleBand: Block = {
  id: 'capsule-band', version: 1, name: 'Band or seal capsules with periodic checks', checker: false, stop: 'finished',
  periodic: { maxMinutes: 30 },
  instruction: 'Record the band solution temperature. Look at the banded capsules: band whole, even and in place. Check the capsules for leaks and count any leakers.',
  fields: [
    { name: 'machine', label: 'Banding or sealing machine', kind: 'machine', types: ['band', 'seal'], notTypes: ['blister', 'strip', 'induction'] },
    { name: 'bandTemp', label: 'Band solution temperature', kind: 'number', unit: '°C' },
    { name: 'appearance', label: 'Band whole, even and in place', kind: 'yes-no' },
    { name: 'leakers', label: 'Leaking capsules found', kind: 'number', unit: 'capsules' },
    { name: 'bandingDone', label: 'Banding finished', kind: 'yes-no' },
  ],
  settings: [{ name: 'tempLimit', label: 'Band solution temperature limits', kind: 'limit', optional: true }],
  calcs: [
    { name: 'tempCheck', label: 'Band solution temperature', template: 'C1', args: { value: '$bandTemp', limit: '$tempLimit' } },
    { name: 'appearanceCheck', label: 'Band whole and even', template: 'C4', args: { question: 'Band whole, even and in place', answers: ['$appearance'], expected: ['yes'] } },
    { name: 'leakCheck', label: 'Leakers', template: 'C1', args: { value: '$leakers', limit: { high: '0', unit: 'capsules' } } },
    { name: 'finished', label: 'Banding finished', template: 'C4', args: { question: 'Banding finished', answers: ['$bandingDone'], expected: ['yes'] } },
  ],
};
