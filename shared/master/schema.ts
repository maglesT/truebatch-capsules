/**
 * A master version is ONE JSON document: the header, the formula, and the stages in order with their steps in order.
 * This schema checks only its shape; whether it makes a good master is for checks.ts. A draft may be incomplete.
 */
import { z } from 'zod';

const decimal = z.string().regex(/^\d+(\.\d+)?$/, 'a plain decimal, e.g. "250.0"');
export const keySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, 'lower-case letters, digits and -');
const text = (max = 200) => z.string().trim().max(max);

export const limitSchema = z.object({
  low: z.string().optional(), high: z.string().optional(), unit: z.string(),
  lowStrict: z.boolean().optional(), highStrict: z.boolean().optional(),
  alertLow: z.string().optional(), alertHigh: z.string().optional(),
}).strict();

// A step setting: a value as written ("0.5", "250.0 mg"), a limit, or a reference to an earlier step's field or
// calculation ("stage/step/name"), to a formula line (its batch quantity, adjusted when asked; or its label claim, for a
// block setting with formulaField) or to the header.
// fillWeight: the fill per capsule; shellWeight: the mean empty shell (hard) or the wet gel mass per capsule (soft gel);
// filledWeight: fill + shell, the theoretical weight of one filled capsule (gross fill-weight target, counts by weight).
export const HEADER_VALUES = ['batchSize', 'fillWeight', 'coatedWeight', 'fillBatch', 'coatedBatch', 'shellWeight', 'filledWeight'] as const;
// The header values per capsule: the only ones a block setting with notBatch 'tablet' takes (the others are per batch).
export const PER_TABLET_HEADERS: readonly (typeof HEADER_VALUES)[number][] = ['fillWeight', 'coatedWeight', 'shellWeight', 'filledWeight'];
export const settingValueSchema = z.union([
  text(),
  limitSchema,
  z.object({ ref: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\/[a-zA-Z0-9]+$/, 'stage/step/name') }).strict(),
  z.object({ formula: keySchema, adjusted: z.boolean().optional() }).strict(),
  z.object({ header: z.enum(HEADER_VALUES) }).strict(),
]);

const flowSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  // Rounds of the same step until the stop check passes, at most maxRounds (then a deviation note is needed).
  z.object({ kind: z.literal('repeat-until'), maxRounds: z.number().int().min(1).max(500).optional(), stop: z.string().optional() }).strict(),
  z.object({ kind: z.literal('optional-with-reason') }).strict(),
  z.object({ kind: z.literal('qa-hold') }).strict(),
]);

export const stepSchema = z.object({
  key: keySchema,
  block: z.object({ id: z.string(), version: z.number().int().min(1) }).strict(),
  // The name people read (e.g. "Punch and die check — after compression"); without it, the block's name and material.
  name: text(120).optional(),
  instruction: text(4000).optional(),
  settings: z.record(z.string(), settingValueSchema).default({}),
  // The performer always signs; a second person checks when true.
  checker: z.boolean(),
  // The next step waits for the check (otherwise it opens when this step is done).
  waitForCheck: z.boolean().default(false),
  critical: z.boolean().default(false),
  minMinutes: z.number().int().positive().max(10_000).optional(),
  everyMinutes: z.number().int().positive().max(10_000).optional(),
  // F6 with a changing interval: after `afterMinutes` from the first round, a round every `everyMinutes` (F0030).
  everyMinutesLater: z.object({ afterMinutes: z.number().int().positive().max(10_000), everyMinutes: z.number().int().positive().max(10_000) }).strict().optional(),
  // F4 by a rule: the step is done only when a header value is within the limit (F0040: the bag premix only for a
  // batch of at most 50 kg); otherwise it is not applicable, with no operator choice.
  onlyIf: z.object({ header: z.enum(['batchSize', 'fillBatch']), limit: limitSchema }).strict().optional(),
  // A spray of a liquid made in excess: the amount of liquid to apply per amount charged (F0339: 971 g per 150 g).
  applyPerCharge: z.object({ liquid: text(40), charge: text(40) }).strict().optional(),
  // Order-critical: this step must come after the step with this key in the same stage (F0318: the drug after the PVP).
  orderAfter: keySchema.optional(),
  flow: flowSchema.default({ kind: 'none' }),
  // Only trained people sign (owner, 17 Nov 2026): the skill Recruitment publishes (training_v1) that the performer and
  // the checker must hold, picked from Recruitment's list (typed only while the link is off). None: anyone may sign.
  training: z.object({ code: text(60).min(1), title: text(200).optional() }).strict().optional(),
}).strict();

export const stageSchema = z.object({
  key: keySchema,
  name: text().min(1),
  kind: z.enum(['normal', 'preparation', 'sub-batch']),
  count: z.number().int().min(2).max(50).optional(),
  roomTypes: z.array(text()).max(20).default([]),
  machineTypes: z.array(text()).max(50).default([]),
  role: text().default(''),
  produces: z.object({ name: text().min(1), holdHours: z.number().positive().max(100_000).optional() }).strict().optional(),
  // Stages whose intermediate this stage uses (preparations must be closed first; their hold time ends here).
  uses: z.array(keySchema).max(20).default([]),
  steps: z.array(stepSchema).max(200),
}).strict();

const form = z.object({
  name: text().min(1), mw: decimal, moleculesPerUnit: z.number().int().min(1).optional(), hydrateOrSolvate: z.boolean().optional(),
  // The ion's charge, for a label claim in mEq (F0393).
  charge: z.number().int().min(1).max(4).optional(),
}).strict();

export const lineSchema = z.object({
  key: keySchema,
  materialItemId: z.string().min(1).max(100),
  code: text(),
  name: text(),
  mgPerCapsule: decimal,
  // A solvent is removed in processing (granulation water) and is not part of the fill weight.
  role: z.enum(['api', 'excipient', 'solvent']),
  // shell: the empty hard shell (one line at the mean empty shell weight, weighed: count by weight) or the gel mass
  // lines of a soft gel (gelatin, plasticiser, water, colour); they add up to the header's shellWeightMg.
  place: z.enum(['intragranular', 'extragranular', 'binder', 'coating', 'shell']),
  layer: z.number().int().min(1).max(10).optional(),
  // The API's label claim per capsule ("20 mg", "10 mEq", "60000 IU"), on the basis the label-basis answer gives; checked
  // against the mg per capsule, and used only by a block setting that reads it (uniformity by weight, T14).
  labelClaim: text(40).optional(),
  // A batch quantity as written in the source ("120.000 kg"); only checked against mg per capsule × batch size (T8).
  batchQuantity: text(40).optional(),
  // Settings of the adjustment templates, applied in this order: T11 salt factor, T9 potency or T18 content, T16
  // overage; or, for a filler, T10 compensation of the named lines.
  adjust: z.object({
    // `factor`: the salt factor as written in the formula; only checked against the molecular weights, never used.
    salt: z.object({ from: form, to: form, factor: decimal.optional() }).strict().optional(),
    potency: z.object({
      basis: z.enum(['as is', 'anhydrous', 'dried', 'ignited', 'anhydrous and solvent-free']),
      standardIs: z.enum(['anhydrous', 'hydrate or solvate']).optional(),
      assayExpressedAs: z.enum(['anhydrous substance', 'hydrate']).optional(),
      potencyAs: z.enum(['parent', 'element']).optional(),
      assayAbove100: z.enum(['use', 'treat as 100']).optional(),
    }).strict().optional(),
    content: z.object({
      formulaQuantityIs: z.enum(['dry', 'wet']), nominalContent: z.string().optional(), contentSource: z.enum(['certificate', 'in-process result']).optional(),
      // What an in-process result is: the content, or a relative assay in % of theoretical (F0205).
      resultType: z.enum(['content', 'percent of theoretical']).optional(),
    }).strict().optional(),
    overage: z.object({ percent: decimal, maxPercent: decimal.optional() }).strict().optional(),
    compensates: z.array(keySchema).max(20).optional(),
  }).strict().optional(),
}).strict();

export const SHELL_TYPES = ['hard gelatin', 'HPMC', 'soft gelatin'] as const;
export const isSoftGel = (h: { shellType?: string }) => h.shellType === 'soft gelatin';

export const headerSchema = z.object({
  productItemId: z.string().min(1).max(100),
  productCode: text(),
  productName: text(),
  batchSize: z.string().regex(/^[1-9]\d{0,9}$/, 'a whole number of capsules'),
  // The fill per capsule (blend, pellets or fill medicine).
  fillWeightMg: decimal,
  // TC-01: the shell. Optional in the shape (a draft may be incomplete); the master check asks for it.
  shellType: z.enum(SHELL_TYPES).optional(),
  // Hard capsules: the shell size ("0", "1", "00el").
  shellSize: text(20).optional(),
  // Hard: the mean empty shell weight; soft gel: the wet gel mass per capsule.
  shellWeightMg: decimal.optional(),
  // TC-24: a US OTC product: a two-piece hard capsule needs a sealing (banding) step.
  usOtc: z.boolean().optional(),
  coatedWeightMg: decimal.optional(),
  // Other strengths compressed from the same blend at their own fill weight (F0225, F0366).
  otherStrengths: z.array(z.object({ name: text().min(1), labelClaim: text(40), fillWeightMg: decimal, shellSize: text(20).optional(), shellWeightMg: decimal.optional() }).strict()).max(10).optional(),
  // TC-11: the rooms of master data (codes) where this product's materials are weighed; a balance is offered there or
  // in a room the stage allows (shared/engine/picks.ts). A version made before this setting has none.
  dispensingRooms: z.array(text()).max(20).optional(),
}).strict();

// The author's answer to a calculation warning (checks.ts), keyed by the warning and its item. `about` is the warning
// as answered: when the warning reads differently (the item changed), it needs a new answer.
export const answerSchema = z.object({ about: text(1000), choice: text().min(1), reason: text(1000) }).strict();

// TrueBatch Capsules Packing (TC-P1): a packing master is per product, pack type and size, and destination. Its header
// names the finished pack product, the standard packing batch in capsules (batchSize) and the theoretical weight of one
// bulk capsule (fillWeightMg, for counts by weight); `pack` holds the rest. Its formula is empty: the packing materials
// are `pack.materials`, and a step setting { formula: key } names one of them.
export const PACK_TYPES = ['blister', 'strip', 'bottle'] as const;
export const PACK_MATERIAL_KINDS = ['foil', 'forming film', 'carton', 'leaflet', 'label', 'shipper', 'bottle', 'closure', 'desiccant', 'other'] as const;
export const DESTINATIONS = ['India domestic', 'Export'] as const;
export const packMaterialSchema = z.object({
  key: keySchema,
  materialItemId: z.string().min(1).max(100),
  code: text(),
  name: text(),
  kind: z.enum(PACK_MATERIAL_KINDS),
  // Printed (artwork): issued only by its step with a second person, reconciled to zero (TC-P4, TC-P6).
  printed: z.boolean(),
  // Coded on the line with the batch number, dates and MRP (TC-P5, TC-P9); leftovers are destroyed.
  coded: z.boolean(),
  perPack: decimal,
  unit: z.enum(['units', 'm', 'g']),
}).strict();
export const packSchema = z.object({
  bulkItemId: z.string().min(1).max(100),
  bulkCode: text(),
  bulkName: text(),
  type: z.enum(PACK_TYPES),
  // Capsules in one blister, strip or bottle, and packs in one carton.
  unitsPerPack: z.number().int().min(1).max(10_000),
  packsPerCarton: z.number().int().min(1).max(1000),
  // The approved shelf life (TC-P8): the expiry is worked out from it, never typed.
  shelfLifeMonths: z.number().int().min(1).max(120),
  // "month before": expiry = month of manufacture + shelf life − 1 (use before the end of that month).
  expiryRule: z.enum(['month before', 'same month']).default('month before'),
  destination: z.enum(DESTINATIONS),
  // Maximum retail price per pack in rupees (India domestic, TC-P9).
  mrp: decimal.optional(),
  // The pack's GTIN, for checking the codes of the customer's serialisation system.
  gtin: z.string().regex(/^\d{14}$/, '14 digits').optional(),
  serialisation: z.boolean().default(false),
  materials: z.array(packMaterialSchema).max(50),
}).strict();

export const masterSchema = z.object({
  header: headerSchema,
  formula: z.array(lineSchema).max(100),
  stages: z.array(stageSchema).max(50),
  answers: z.record(z.string().max(120), answerSchema).optional(),
  pack: packSchema.optional(),
}).strict();

export type MasterDoc = z.infer<typeof masterSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type Step = z.infer<typeof stepSchema>;
export type FormulaLine = z.infer<typeof lineSchema>;
export type SettingValue = z.infer<typeof settingValueSchema>;
export type Limit = z.infer<typeof limitSchema>;
export type Answer = z.infer<typeof answerSchema>;
export type Pack = z.infer<typeof packSchema>;
export type PackMaterial = z.infer<typeof packMaterialSchema>;

/** Every material a step may name: the formula lines, or a packing master's packing materials. */
export const materialLines = (doc: MasterDoc): (FormulaLine | PackMaterial)[] => [...doc.formula, ...(doc.pack?.materials ?? [])];

export const MASTER_STATES = ['draft', 'in_review', 'approved', 'effective', 'retired'] as const;
export type MasterState = (typeof MASTER_STATES)[number];
