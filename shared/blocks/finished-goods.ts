import type { Block } from './format.js';

// Packing, TC-P2 and TC-P6: the finished goods quantity, and the reconciliation of the bulk capsules issued: the capsules
// in good packs and in samples (packs × capsules per pack, T8), the good capsules returned and the rejected capsules
// counted by weight (T6), the yield in packs (T3) and the accountability of every capsule issued (T4). Always checked.
export const finishedGoods: Block = {
  id: 'finished-goods', version: 1, name: 'Finished goods and reconciliation of capsules', gmp: 'yield', checker: true, packing: true,
  instruction: 'Count the good packs in finished cartons and the packs taken as samples. Weigh the good bulk capsules returned and the capsules taken out of rejected packs.',
  fields: [
    { name: 'packs', label: 'Good packs in finished cartons', kind: 'number', unit: 'packs' },
    { name: 'cartons', label: 'Finished cartons', kind: 'number', unit: 'nos' },
    { name: 'shippers', label: 'Shippers', kind: 'number', unit: 'nos', optional: true },
    { name: 'samples', label: 'Packs taken as reserve and QC samples', kind: 'number', unit: 'packs' },
    { name: 'returnedWeight', label: 'Net weight of good bulk capsules returned', kind: 'number', unit: 'kg' },
    { name: 'rejectWeight', label: 'Net weight of rejected capsules', kind: 'number', unit: 'kg' },
  ],
  settings: [
    // A weight per capsule (the capsules are counted by weight): the header's capsule weight or typed; never a batch weight.
    { name: 'meanWeight', label: 'Mean capsule weight', kind: 'quantity', notBatch: 'tablet' },
    { name: 'yieldLimit', label: 'Yield limits (packs)', kind: 'limit' },
    { name: 'accountabilityLimit', label: 'Accountability limits (capsules)', kind: 'limit' },
  ],
  calcs: [
    { name: 'packed', label: 'Capsules in good packs', template: 'T8', args: { mode: 'per unit', perUnit: '$pack.unitsPerPack', count: '$packs' } },
    { name: 'sampled', label: 'Capsules in samples', template: 'T8', args: { mode: 'per unit', perUnit: '$pack.unitsPerPack', count: '$samples' } },
    { name: 'returned', label: 'Good capsules returned', template: 'T6', args: { mode: 'ratio', a: '$returnedWeight', b: '$meanWeight', unit: 'capsules', decimals: 0 } },
    { name: 'rejects', label: 'Rejected capsules', template: 'T6', args: { mode: 'ratio', a: '$rejectWeight', b: '$meanWeight', unit: 'capsules', decimals: 0 } },
    { name: 'yield', label: 'Yield', template: 'T3', args: { actual: '$packs', theoretical: '$batch.packs', limit: '$yieldLimit' } },
    { name: 'accountability', label: 'Accountability of the capsules issued', template: 'T4', args: { input: '$batch.capsules',
      parts: [{ name: 'in packs', value: '$packed' }, { name: 'samples', value: '$sampled' }, { name: 'returned', value: '$returned' }, { name: 'rejects', value: '$rejects' }],
      limit: '$accountabilityLimit' } },
  ],
};

/**
 * A pack with no carton material (a bottle pack: packs per carton = bottles per shipper) counts its packs in cartons or
 * shippers: the labels say so (display backlog 19 Nov 2026). Display only; the values and checks are the same.
 */
export function packWords(b: Block, pack?: { materials: readonly { kind: string }[] } | null): Block {
  if (b.id !== 'finished-goods' || !pack || pack.materials.some((m) => m.kind === 'carton')) return b;
  const label: Record<string, string> = { packs: 'Good packs in finished cartons or shippers', cartons: 'Finished cartons or shippers' };
  return { ...b, fields: b.fields.map((f) => (label[f.name] ? { ...f, label: label[f.name]! } : f)) };
}
