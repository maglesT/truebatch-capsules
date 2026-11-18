import type { Block } from './format.js';

// Soft gel drying, used as repeat-until (one block for tumble and tray drying: two steps). Each round: temperature and
// RH of the dryer or drying room (C1) and the hardness of 5 capsules (T7 mean, C3 each); the rounds stop when every
// capsule's hardness is within the limits. The minimum drying time is the step's minimum time (minMinutes).
export const softgelDry: Block = {
  id: 'softgel-dry', version: 1, name: 'Dry soft gels to a hardness', checker: false, stop: 'hardnessEach',
  instruction: 'Record the temperature and relative humidity of the dryer or drying room. Take 5 capsules and record their hardness.',
  fields: [
    { name: 'machine', label: 'Tumble dryer (none for tray drying in the room)', kind: 'machine', types: ['dryer', 'drier', 'tumble'], notTypes: ['fluid bed', 'fbd'], optional: true },
    { name: 'temperature', label: 'Temperature', kind: 'number', unit: '°C' },
    { name: 'rh', label: 'Relative humidity', kind: 'number', unit: '%RH' },
    { name: 'hardness', label: 'Hardness of 5 capsules', kind: 'number', unit: 'N', count: 5 },
  ],
  settings: [
    { name: 'tempLimit', label: 'Temperature limits', kind: 'limit' },
    { name: 'rhLimit', label: 'Relative humidity limits', kind: 'limit' },
    { name: 'hardnessLimit', label: 'Hardness limits (each capsule)', kind: 'limit' },
  ],
  calcs: [
    { name: 'tempCheck', label: 'Temperature', template: 'C1', args: { value: '$temperature', limit: '$tempLimit' } },
    { name: 'rhCheck', label: 'Relative humidity', template: 'C1', args: { value: '$rh', limit: '$rhLimit' } },
    { name: 'meanHardness', label: 'Mean hardness', template: 'T7', args: { readings: '$hardness' } },
    { name: 'hardnessEach', label: 'Hardness of each capsule', template: 'C3', args: { readings: '$hardness', band: { limit: '$hardnessLimit' }, noun: 'capsules' } },
  ],
};
