import type { Product } from '../server/product.js';

// TrueBatch Capsules Packing: the packing batch record, from the RELEASED bulk capsules of TrueBatch Capsules to QA
// release of the packed batch. Its permissions are its own (the platform's code format allows no "-"); the app reads
// each as the TrueBatch code of the same thing (server/product.ts). QC approves the packed batch (the finished packed
// product tested and complies, with the QC report number) before QA releases it, as for capsules (owner, 15 Nov 2026).
export const PACKING: Product = {
  id: 'truebatch_capsules_packing',
  name: 'TrueBatch Capsules Packing',
  batchPrefix: 'TCP',
  permissions: {
    'truebatch_capsules_packing.master.author': 'Write packing master record versions',
    'truebatch_capsules_packing.master.check': 'Check a packing master record version written by another person',
    'truebatch_capsules_packing.master.approve': 'Approve a checked packing master record version (QA)',
    'truebatch_capsules_packing.batch.issue': 'Issue a packing batch record from a released bulk batch',
    'truebatch_capsules_packing.batch.operate': 'Record and sign packing steps as performed',
    'truebatch_capsules_packing.batch.check': 'Check packing steps performed by another person (second person)',
    'truebatch_capsules_packing.batch.supervise': 'Production approval of a completed packing record',
    'truebatch_capsules_packing.qc.approve': 'QC approval of the finished packed product (tested and complies)',
    'truebatch_capsules_packing.qa.release': 'QA review and release of packed batches',
    'truebatch_capsules_packing.view': 'View packing records and packing master versions',
    'truebatch_capsules_packing.demo.skip': 'Skip a running wait (demo installations only)',
    'truebatch_capsules_packing.exception.decide': 'Decide a deviation note without a number: close it here (reason and e-signature) or send it to DIVE',
  },
};
