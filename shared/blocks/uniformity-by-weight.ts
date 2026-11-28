import type { Block } from './format.js';

// Copied from Tablets with capsule wording (data change 3). Uniformity of dosage units by weight variation (T14) on the
// NET contents: each of 10 capsules weighed full, then its empty shell (hard) or washed shell (soft gel); each capsule's
// content from its net fill and the assay. Only for hard capsules and soft capsules with a solution fill: T14 and the
// master check refuse any other.
// Round 44 (found by Capsules on the demo, TC260003): the assay is an IN-PROCESS test of this step, not the batch's
// release CoA (the step comes mid-production, after filling: waiting for full release testing would hold the line). The
// step's lab request asks QC for the assay of a composite sample of the capsules (USP <905> weight variation), a single
// result (LIMS figure 'result'); the acceptance value is worked out from it. A step started before this has no lab
// request for it: its assay is typed (round 43, "started before LIMS in-process requests").
const caps = Array.from({ length: 10 }, (_, i) => `c${i + 1}`);
export const uniformityByWeight: Block = {
  id: 'uniformity-by-weight', version: 1, name: 'Uniformity by weight variation', checker: true,
  instruction: 'Weigh 10 capsules one by one. Open each, empty it (soft gels: wash out the fill and dry the shell) and weigh its shell. Send a composite sample of the capsules to QC for the assay and pick its result from QLIMS once QC has approved it (typed from the QC report only while QLIMS cannot be reached).',
  fields: [
    { name: 'balance', label: 'Balance', kind: 'machine', types: ['balance'], notTypes: ['analytical', 'micro'] },
    ...caps.map((c, i) => ({ name: c, label: `Capsule ${i + 1}: full, then shell`, kind: 'number' as const, unit: 'mg', count: 2 })),
    { name: 'assay', label: 'Assay (% of label claim, QC report)', kind: 'number', unit: '%', qc: 'in_process' },
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
