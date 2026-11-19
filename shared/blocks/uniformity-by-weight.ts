import type { Block } from './format.js';

// Copied from Tablets with capsule wording (data change 3). Uniformity of dosage units by weight variation (T14) on the
// NET contents: each of 10 capsules weighed full, then its empty shell (hard) or washed shell (soft gel); each capsule's
// content from its net fill and the assay. Only for hard capsules and soft capsules with a solution fill: T14 and the
// master check refuse any other.
const caps = Array.from({ length: 10 }, (_, i) => `c${i + 1}`);
export const uniformityByWeight: Block = {
  id: 'uniformity-by-weight', version: 1, name: 'Uniformity by weight variation', checker: true,
  instruction: 'Weigh 10 capsules one by one. Open each, empty it (soft gels: wash out the fill and dry the shell) and weigh its shell. Record the assay of the batch from the QC report.',
  fields: [
    { name: 'balance', label: 'Balance', kind: 'machine', types: ['balance'], notTypes: ['analytical', 'micro'] },
    ...caps.map((c, i) => ({ name: c, label: `Capsule ${i + 1}: full, then shell`, kind: 'number' as const, unit: 'mg', count: 2 })),
    { name: 'assay', label: 'Assay (% of label claim, QC report)', kind: 'number', unit: '%', qc: true },
  ],
  settings: [
    { name: 'coating', label: 'Dosage unit', kind: 'text', options: ['hard capsule', 'soft capsule, solution fill'] },
    // A formula line gives its label claim per capsule (never its batch quantity): pulled from the API line.
    { name: 'labelClaim', label: 'Label claim per capsule', kind: 'quantity', formulaField: 'labelClaim' },
  ],
  calcs: [
    { name: 'acceptance', label: 'Content uniformity', template: 'T14', args: { method: 'weight variation', coating: '$coating', weights: { units: caps.map((c) => `$${c}`), combine: 'first minus rest' }, assay: '$assay', labelClaim: '$labelClaim' } },
  ],
};
