import type { Block } from './format.js';

// Variant of softgel-dry (owner, 18 Nov 2026: variants are their own blocks): the drying end point is the water content
// of the shell (C1) instead of the hardness. Repeat-until; the minimum drying time is the step's minimum time.
export const softgelDryWater: Block = {
  id: 'softgel-dry-water', version: 1, name: 'Dry soft gels to a shell water content', checker: false, stop: 'waterCheck',
  instruction: 'Record the temperature and relative humidity of the dryer or drying room. Take a sample of capsules and record the water content of the shells.',
  fields: [
    { name: 'machine', label: 'Tumble dryer (none for tray drying in the room)', kind: 'machine', types: ['dryer', 'drier', 'tumble'], notTypes: ['fluid bed', 'fbd'], optional: true },
    { name: 'temperature', label: 'Temperature', kind: 'number', unit: '°C' },
    { name: 'rh', label: 'Relative humidity', kind: 'number', unit: '%RH' },
    { name: 'water', label: 'Shell water content', kind: 'number', unit: '%' },
  ],
  settings: [
    { name: 'tempLimit', label: 'Temperature limits', kind: 'limit' },
    { name: 'rhLimit', label: 'Relative humidity limits', kind: 'limit' },
    { name: 'waterLimit', label: 'Shell water content limits', kind: 'limit' },
  ],
  calcs: [
    { name: 'tempCheck', label: 'Temperature', template: 'C1', args: { value: '$temperature', limit: '$tempLimit' } },
    { name: 'rhCheck', label: 'Relative humidity', template: 'C1', args: { value: '$rh', limit: '$rhLimit' } },
    { name: 'waterCheck', label: 'Shell water content', template: 'C1', args: { value: '$water', limit: '$waterLimit' } },
  ],
};
