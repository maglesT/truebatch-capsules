import type { Block } from './format.js';

// Fix round 21 Nov 2026 (B, owner "fix these now"): after a pellet coat (pellet-coat), dry or cure the coated pellets
// at the master's temperature for at least its time (C1), weigh them all, and sieve them on the master's screens
// (intact before and after, C4). The weight gain is on the kilograms of cores (T5 on the starting weight: an earlier
// step's output, a formula line or typed), and the sieve fraction kept is a % of the pellets sieved (T3). Oversize
// and fines are weighed; the stage's yield and accountability are the stage-yield step, as in every stage.
export const pelletCureSieve: Block = {
  id: 'pellet-cure-sieve', version: 1, name: 'Dry or cure, weigh and sieve coated pellets', checker: true,
  instruction: 'Dry or cure the coated pellets, weigh them all, then sieve them. Check the screens before and after use, and weigh the pellets kept, the oversize and the fines.',
  fields: [
    { name: 'dryer', label: 'Dryer or oven', kind: 'machine', types: ['dryer', 'drier', 'fbd', 'fluid bed', 'oven', 'coat'] },
    { name: 'cureTemp', label: 'Product temperature while drying or curing', kind: 'number', unit: '°C' },
    { name: 'cureTime', label: 'Drying or curing time', kind: 'number', unit: 'min' },
    { name: 'coatedWeight', label: 'Net weight of all coated pellets', kind: 'number', unit: 'kg' },
    { name: 'sifter', label: 'Sifter', kind: 'machine', types: ['sift', 'sieve', 'screen'] },
    { name: 'intactBefore', label: 'Screens as the master says and intact before use', kind: 'yes-no' },
    { name: 'kept', label: 'Pellets kept (the sieve fraction)', kind: 'number', unit: 'kg' },
    { name: 'oversize', label: 'Oversize (agglomerates)', kind: 'number', unit: 'kg' },
    { name: 'fines', label: 'Fines', kind: 'number', unit: 'kg' },
    { name: 'intactAfter', label: 'Screens intact after use', kind: 'yes-no' },
  ],
  settings: [
    // The cores coated: an earlier step's output (the last stage yield), a formula line's batch quantity or typed.
    { name: 'coresWeight', label: 'Weight of the cores coated', kind: 'quantity' },
    { name: 'gainLimit', label: 'Weight gain limits (% of the cores)', kind: 'limit' },
    { name: 'cureTempLimit', label: 'Drying or curing temperature limits', kind: 'limit' },
    { name: 'cureTimeLimit', label: 'Drying or curing time limits', kind: 'limit' },
    { name: 'screens', label: 'Screens (the sieve fraction, e.g. 1.4 mm and 0.71 mm)', kind: 'text' },
    { name: 'fractionLimit', label: 'Sieve fraction kept limits (% of the pellets sieved)', kind: 'limit', optional: true },
  ],
  calcs: [
    { name: 'cureTempCheck', label: 'Drying or curing temperature', template: 'C1', args: { value: '$cureTemp', limit: '$cureTempLimit' } },
    { name: 'cureTimeCheck', label: 'Drying or curing time', template: 'C1', args: { value: '$cureTime', limit: '$cureTimeLimit' } },
    { name: 'gain', label: 'Weight gain on the cores', template: 'T5', args: { before: '$coresWeight', after: '$coatedWeight', mode: 'gain', base: 'start', limit: '$gainLimit' } },
    { name: 'fraction', label: 'Sieve fraction kept', template: 'T3', args: { actual: '$kept', theoretical: '$coatedWeight', limit: '$fractionLimit' } },
    { name: 'screenCheck', label: 'Screens', template: 'C4', args: { question: 'Screens as the master says and intact before and after use', answers: ['$intactBefore', '$intactAfter'], expected: ['yes'] } },
  ],
};
