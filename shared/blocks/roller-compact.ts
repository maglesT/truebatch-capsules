import type { Block } from './format.js';

// Dry granulation by roller compaction with periodic in-process checks (F6): one round every N minutes (at most 30,
// TB-15) until compaction is finished. Each round: the set points read on the compactor (roll force in the unit the
// compactor shows, roll gap, roll speed, feed screw speed) against the master's limits (C1); the ribbon (thickness of
// 3 pieces, T7 mean; density, C1); the fines of the milled granules (C1); and the mill screen the master names, as
// shown and intact (C4). Out of limits: a deviation note before the round is signed, as every block. The yield is the
// stage's yield step after it (stage-yield), as for wet granulation.
export const rollerCompact: Block = {
  id: 'roller-compact', version: 1, name: 'Roller compaction with periodic checks', checker: false, stop: 'finished',
  periodic: { maxMinutes: 30 },
  instruction: 'Read the roll force, roll gap, roll speed and feed screw speed on the compactor. Measure the thickness of 3 ribbon pieces and the ribbon density, and the fines of the milled granules. Check the mill screen.',
  fields: [
    { name: 'machine', label: 'Roller compactor', kind: 'machine', types: ['compactor', 'chilsonator'] },
    { name: 'rollForce', label: 'Roll force', kind: 'number', unit: '$forceUnit' },
    { name: 'rollGap', label: 'Roll gap', kind: 'number', unit: 'mm' },
    { name: 'rollSpeed', label: 'Roll speed', kind: 'number', unit: 'rpm' },
    { name: 'feedSpeed', label: 'Feed screw speed', kind: 'number', unit: 'rpm' },
    { name: 'millSpeed', label: 'Mill speed', kind: 'number', unit: 'rpm', optional: true },
    { name: 'ribbonThickness', label: 'Thickness of 3 ribbon pieces', kind: 'number', unit: 'mm', count: 3 },
    { name: 'ribbonDensity', label: 'Ribbon density', kind: 'number', unit: 'g/cm³' },
    { name: 'fines', label: 'Fines of the milled granules', kind: 'number', unit: '%' },
    { name: 'screenOk', label: 'Mill screen as shown and intact', kind: 'yes-no' },
    { name: 'compactionDone', label: 'Compaction finished', kind: 'yes-no' },
  ],
  settings: [
    { name: 'forceUnit', label: 'Roll force unit (as the compactor shows it)', kind: 'text', options: ['kN/cm', 'kN', 'bar'] },
    { name: 'forceLimit', label: 'Roll force limits', kind: 'limit' },
    { name: 'gapLimit', label: 'Roll gap limits', kind: 'limit' },
    { name: 'rollSpeedLimit', label: 'Roll speed limits', kind: 'limit', optional: true },
    { name: 'feedSpeedLimit', label: 'Feed screw speed limits', kind: 'limit', optional: true },
    { name: 'screen', label: 'Mill screen (aperture)', kind: 'text' },
    { name: 'thicknessLimit', label: 'Ribbon thickness limits', kind: 'limit', optional: true },
    { name: 'densityLimit', label: 'Ribbon density limits', kind: 'limit', optional: true },
    { name: 'finesLimit', label: 'Fines limits', kind: 'limit' },
  ],
  calcs: [
    { name: 'forceCheck', label: 'Roll force', template: 'C1', args: { value: '$rollForce', limit: '$forceLimit' } },
    { name: 'gapCheck', label: 'Roll gap', template: 'C1', args: { value: '$rollGap', limit: '$gapLimit' } },
    { name: 'rollSpeedCheck', label: 'Roll speed', template: 'C1', args: { value: '$rollSpeed', limit: '$rollSpeedLimit' } },
    { name: 'feedSpeedCheck', label: 'Feed screw speed', template: 'C1', args: { value: '$feedSpeed', limit: '$feedSpeedLimit' } },
    { name: 'meanThickness', label: 'Ribbon thickness', template: 'T7', args: { readings: '$ribbonThickness', limit: '$thicknessLimit?' } },
    { name: 'densityCheck', label: 'Ribbon density', template: 'C1', args: { value: '$ribbonDensity', limit: '$densityLimit' } },
    { name: 'finesCheck', label: 'Fines', template: 'C1', args: { value: '$fines', limit: '$finesLimit' } },
    { name: 'screenCheck', label: 'Mill screen', template: 'C4', args: { question: 'Mill screen as shown and intact', answers: ['$screenOk'], expected: ['yes'] } },
    { name: 'finished', label: 'Compaction finished', template: 'C4', args: { question: 'Compaction finished', answers: ['$compactionDone'], expected: ['yes'] } },
  ],
};
