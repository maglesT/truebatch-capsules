/** The block library: each block is a description file; a new block (or a new version of one) is a new file here. */
import type { Block } from './format.js';
import { binderSolution } from './binder-solution.js';
import { blendUniformity } from './blend-uniformity.js';
import { charge } from './charge.js';
import { check } from './check.js';
import { checkObserve } from './check-observe.js';
import { checkweigh } from './checkweigh.js';
import { capsuleBand } from './capsule-band.js';
import { capsuleFill } from './capsule-fill.js';
import { capsuleFillNet } from './capsule-fill-net.js';
import { capsuleReconciliation } from './capsule-reconciliation.js';
import { dryObserve } from './dry-observe.js';
import { gelMass } from './gel-mass.js';
import { metalCheck } from './metal-check.js';
import { softgelDry } from './softgel-dry.js';
import { softgelDryWater } from './softgel-dry-water.js';
import { softgelEncapsulate } from './softgel-encapsulate.js';
import { coatingSuspension } from './coating-suspension.js';
import { contentUniformity } from './content-uniformity.js';
import { densityFlow } from './density-flow.js';
import { disintegration } from './disintegration.js';
import { dissolution } from './dissolution.js';
import { dryConstant } from './dry-constant.js';
import { dryMix } from './dry-mix.js';
import { dry } from './dry.js';
import { granulate } from './granulate.js';
import { lineClearance } from './line-clearance.js';
import { lubricate } from './lubricate.js';
import { mix } from './mix.js';
import { rollerCompact } from './roller-compact.js';
import { polishPrint } from './polish-print.js';
import { qaSample } from './qa-sample.js';
import { sieveAnalysis } from './sieve-analysis.js';
import { sieve } from './sieve.js';
import { sift } from './sift.js';
import { sprayCoat } from './spray-coat.js';
import { stageYield } from './stage-yield.js';
import { subBatchCombine } from './sub-batch-combine.js';
import { uniformityByWeight } from './uniformity-by-weight.js';
import { weigh } from './weigh.js';
import { bulkIssue } from './bulk-issue.js';
import { cartonCheck } from './carton-check.js';
import { codingCheck } from './coding-check.js';
import { destruction } from './destruction.js';
import { finishedGoods } from './finished-goods.js';
import { formingCheck } from './forming-check.js';
import { leakTest } from './leak-test.js';
import { lineSetup } from './line-setup.js';
import { onlineInspection } from './online-inspection.js';
import { packClearance } from './pack-clearance.js';
import { packClearanceAfter } from './pack-clearance-after.js';
import { packMaterialIssue } from './pack-material-issue.js';
import { printedReconciliation } from './printed-reconciliation.js';
import { serialReceived } from './serial-received.js';
import { serialReconciliation } from './serial-reconciliation.js';
import { serialSample } from './serial-sample.js';
import { visionChallenge } from './vision-challenge.js';

export type { Block, BlockField, BlockSetting } from './format.js';
// In the order of a process: dispensing and preparation, granulation and blending, gel mass, filling or encapsulation,
// drying, banding, the capsule tests, coating and sorting, then the steps of any stage.
export const BLOCKS: readonly Block[] = [
  weigh, charge, sift, binderSolution, coatingSuspension, dryMix, mix, granulate, rollerCompact, dry, dryConstant, sieve, lubricate,
  subBatchCombine, blendUniformity, densityFlow, sieveAnalysis, gelMass, capsuleFill, capsuleFillNet, softgelEncapsulate, softgelDry, softgelDryWater, dryObserve, capsuleBand,
  disintegration, dissolution, uniformityByWeight, contentUniformity, sprayCoat, polishPrint, checkweigh, metalCheck, check,
  checkObserve, qaSample, stageYield, capsuleReconciliation, lineClearance,
  // TrueBatch Capsules Packing, in the order of a packing record.
  bulkIssue, packMaterialIssue, packClearance, lineSetup, visionChallenge, serialReceived, codingCheck, formingCheck, leakTest, onlineInspection,
  cartonCheck, serialSample, finishedGoods, printedReconciliation, serialReconciliation, destruction, packClearanceAfter,
];
// The blocks either product's masters may use besides its own.
export const GENERAL_BLOCKS = ['check', 'qa-sample'];
/** The blocks a master offers: a packing master's (it has a pack) or a capsule master's. */
export const blocksFor = (packing: boolean) => BLOCKS.filter((b) => GENERAL_BLOCKS.includes(b.id) || !!b.packing === packing);

export function findBlock(ref: { id: string; version: number }): Block | undefined {
  return BLOCKS.find((b) => b.id === ref.id && b.version === ref.version);
}
