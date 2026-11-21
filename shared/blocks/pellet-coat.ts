import type { Block } from './format.js';

// Fix round 21 Nov 2026 (B, owner "fix these now"): coating pellets in a fluid bed (Wurster) with periodic spray
// checks (F6), for drug layering, a sub-coat or an enteric coat: one round every N minutes (at most 30) with the spray
// conditions against the master's limits (C1) and the coating suspension sprayed so far. The rounds stop when the
// amount the master says is sprayed (C1, as spray-coat stops at its weight gain). The weight gain on the kilograms of
// cores, the drying or curing and the sieving follow in the next step (pellet-cure-sieve). The suspension itself is
// the coating-suspension step before it (made fresh, TC-16).
export const pelletCoat: Block = {
  id: 'pellet-coat', version: 1, name: 'Coat pellets with periodic spray checks', checker: false, stop: 'sprayedCheck',
  periodic: { maxMinutes: 30 },
  instruction: 'Record the inlet and product temperatures, the spray rate and the atomising air pressure, and the coating suspension sprayed so far.',
  fields: [
    { name: 'machine', label: 'Fluid bed coater', kind: 'machine', types: ['coat'] },
    { name: 'inletTemp', label: 'Inlet temperature', kind: 'number', unit: '°C' },
    { name: 'bedTemp', label: 'Product temperature', kind: 'number', unit: '°C' },
    { name: 'sprayRate', label: 'Spray rate', kind: 'number', unit: 'g/min' },
    { name: 'airPressure', label: 'Atomising air pressure', kind: 'number', unit: 'bar' },
    { name: 'sprayed', label: 'Coating suspension sprayed so far', kind: 'number', unit: 'kg' },
  ],
  settings: [
    { name: 'sprayedLimit', label: 'Coating suspension to spray (limits)', kind: 'limit' },
    { name: 'inletLimit', label: 'Inlet temperature limits', kind: 'limit', optional: true },
    { name: 'bedLimit', label: 'Product temperature limits', kind: 'limit' },
    { name: 'sprayRateLimit', label: 'Spray rate limits', kind: 'limit', optional: true },
    { name: 'airPressureLimit', label: 'Atomising air pressure limits', kind: 'limit', optional: true },
  ],
  calcs: [
    { name: 'inletCheck', label: 'Inlet temperature', template: 'C1', args: { value: '$inletTemp', limit: '$inletLimit' } },
    { name: 'bedCheck', label: 'Product temperature', template: 'C1', args: { value: '$bedTemp', limit: '$bedLimit' } },
    { name: 'sprayRateCheck', label: 'Spray rate', template: 'C1', args: { value: '$sprayRate', limit: '$sprayRateLimit' } },
    { name: 'airPressureCheck', label: 'Atomising air pressure', template: 'C1', args: { value: '$airPressure', limit: '$airPressureLimit' } },
    { name: 'sprayedCheck', label: 'Coating suspension sprayed', template: 'C1', args: { value: '$sprayed', limit: '$sprayedLimit' } },
  ],
};
