import type { Block } from './format.js';

// Mix for a time. The master step's minimum time (minMinutes) stops the step being finished earlier. A soft gel fill
// medicine is mixed in its preparation tank.
export const mix: Block = {
  id: 'mix', version: 1, name: 'Mix for a time', checker: false,
  instruction: 'Mix at the speed shown for at least the time shown.',
  fields: [
    { name: 'machine', label: 'Mixer', kind: 'machine', types: ['mix', 'stirrer', 'blend', 'vessel', 'tank'] },
    { name: 'speed', label: 'Speed', kind: 'number', unit: 'rpm' },
  ],
  settings: [{ name: 'speedLimit', label: 'Speed limits', kind: 'limit', optional: true }],
  calcs: [{ name: 'speedCheck', label: 'Speed against limits', template: 'C1', args: { value: '$speed', limit: '$speedLimit' } }],
};
