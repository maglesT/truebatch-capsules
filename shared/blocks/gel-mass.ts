import type { Block } from './format.js';

// Soft gel: gelatin mass prepared in the melter from the lots charged before it: melt temperature (C1), viscosity
// (C1) and, when the master asks, the water content (C1); the net weight of gel mass made. The deaeration (vacuum) time
// is the step's minimum time; the hold until use is the stage's hold time (TC-17).
export const gelMass: Block = {
  id: 'gel-mass', version: 1, name: 'Prepare the gelatin mass', checker: true,
  instruction: 'Melt the charged materials under stirring, then deaerate under vacuum for at least the time shown. Record the temperature, viscosity and, if asked, the water content, and the net weight of gel mass made.',
  fields: [
    { name: 'machine', label: 'Gelatin melter', kind: 'machine', types: ['melt', 'gelatin', 'vessel'] },
    { name: 'temperature', label: 'Gel mass temperature', kind: 'number', unit: '°C' },
    { name: 'viscosity', label: 'Viscosity', kind: 'number', unit: 'mPa·s' },
    { name: 'water', label: 'Water content', kind: 'number', unit: '%', optional: true },
    { name: 'output', label: 'Net weight of gel mass made', kind: 'number', unit: 'kg' },
  ],
  settings: [
    { name: 'tempLimit', label: 'Temperature limits', kind: 'limit' },
    { name: 'viscosityLimit', label: 'Viscosity limits', kind: 'limit' },
    { name: 'waterLimit', label: 'Water content limits', kind: 'limit', optional: true },
  ],
  calcs: [
    { name: 'tempCheck', label: 'Temperature', template: 'C1', args: { value: '$temperature', limit: '$tempLimit' } },
    { name: 'viscosityCheck', label: 'Viscosity', template: 'C1', args: { value: '$viscosity', limit: '$viscosityLimit' } },
    { name: 'waterCheck', label: 'Water content', template: 'C1', args: { value: '$water', limit: '$waterLimit' } },
  ],
};
