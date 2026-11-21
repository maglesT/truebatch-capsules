# TrueBatch Capsules

An electronic batch record for capsule manufacturing (hard gelatin, HPMC and soft gel capsules), from dispensing to QA
release of bulk filled capsules, on the Medhanta platform. It starts as a copy of TrueBatch Tablets (same engine,
screens and templates); capsule blocks, skeletons and rule changes follow in later rounds. Built the way the Medhanta Logbook is built: one app, plain SQL, a small set of rules checked once in the app.

- Design decisions: `docs/design.md`
- The TrueBatch rules and their tests: `docs/rules.md`

Status: sign-on through core, permissions, the audit trail, e-signatures and master-data reads are in place, with the
calculation templates (`shared/templates/`), the step blocks (`shared/blocks/`), the master document and its checks
(`shared/master/`) and the batch engine (`shared/engine/`, routes in `server/routes/`). The engine also works out the
batch status (production approval, QC approval, QA release or rejection, `shared/engine/release.ts`), marks a step
"input changed" when a value it used was corrected later, and gives QA the review list (`GET /api/batches/:id/review`).
Screens: the master designer with review and QA approval (`web/src/designer/`), issuing a batch from an effective
master (`web/src/floor/IssueDialog.tsx`), the shop floor (`web/src/floor/`) and
the QC and QA release screens with the audit-trail review (`web/src/release/`). The batch record PDF
(`GET /api/batches/:id/pdf`, `server/batch-record.ts`) is made with pdfmake and embedded Noto fonts, as the Logbook
makes its copies. Line clearance is a standard block; the process skeletons start every stage with it. The links to
Deviations, QMS, Logbook and MMS (`server/links.ts`, `docs/design.md` "Links") are optional: with a link the value is
pulled and cannot be typed over; without it, or while it is down, it is typed by hand with a second-person check and
listed for QA. TrueBatch publishes `report.batch_fact_v1` (with `manufactured_on` at its end, 0007, and the product
name and master version, 0008), `equipment_use_v1`, `deviation_note_v1` (`db/migrations/0006_report_views.sql`) and
`material_use_v1`, the quantities dispensed, which MMS reads to reduce lot stock (0008), in the material's master-data
unit; a machine or room is in use by its batch until the last stage of the batch that names it (or may run in its room) closes, a balance is never in use by a batch, and both views name the step in words
(`step_name`, 0010 and 0011). `lab_request_v1` (0020, its status 0021, its test codes 0022) lists the in-process lab requests a step opens when it starts
(blend and content uniformity), for Medhanta LIMS; the step then picks LIMS's approved in-process results of its own
request (`docs/design.md` "LIMS in-process tests"). `reading_v1` (0025, round 46) gives every recorded number of a step signed
done (process parameters and in-process checks, one row per reading) with the master's limits, for Operations'
continued process verification (`docs/design.md` "Readings for CPV"). `master_lab_field_v1` (0029) lists the in-process lab tests of each master version
that is not retired, with the codes its batches' lab requests will name, so LIMS can write its in-process
specification before the first batch. Fix round 21 Nov 2026: bilayer compression, dissolution and in-process lab test
blocks, a tablet layer on formula lines, deleting a draft master, production abandoning a batch before its first step,
undoing a weighing to weigh another lot, balances offered within their range, packing lines of several machines.

## TrueBatch Capsules Packing
The packing batch record is a separate product on the platform, built from this repository on the same engine and
screens: `docs/packing-design.md`, its rules TC-P1 to TC-P9 in `docs/rules.md`. Its own parts are in `packing/` (entry
points, migrations, the views it publishes) and `ops/packing.*`.

```sh
export DATABASE_URL=postgres://truebatch_capsules_owner:dev@localhost:5432/truebatch_capsules_packing_dev DB_APP_ROLE=truebatch_capsules_packing_app
export TRUEBATCH_CAPSULES_DATABASE_URL=postgres://...   # optional: TrueBatch Capsules' published views (released bulk batches)
npm run migrate:packing
npm run dev:packing        # API on :3001
npm run dev:packing-web    # UI on :5174 (proxies /api)
```

## Develop
Needs Node 22 and PostgreSQL 16.

```sh
npm install
export DATABASE_URL=postgres://truebatch_capsules_owner:dev@localhost:5432/truebatch_capsules_dev DB_APP_ROLE=truebatch_capsules_app
# Medhanta core: people, sign-in, TrueBatch permissions and master data are managed there
export MASTER_DATA_DATABASE_URL=postgres://truebatch_capsules_app:...@<core db>:5432/master_data   # read through its report views
# Optional links, each set by the platform only while the link is on:
# DEVIATIONS_DATABASE_URL, QMS_DATABASE_URL, LOGBOOK_DATABASE_URL, MMS_DATABASE_URL, RECRUITMENT_DATABASE_URL, LIMS_DATABASE_URL
export OIDC_ISSUER=https://<core domain>/oidc OIDC_CLIENT_SECRET=... OIDC_REDIRECT_URI=http://localhost:3000/cb
npm run migrate
npm run dev        # API on :3000
npm run dev:web    # UI on :5173 (proxies /api)
npm run ci         # typecheck, tests, build, rule-to-test check — run before pushing
npm run test:e2e   # browser tests (Playwright; once: npx playwright install chromium)
```

Tests use `TEST_DATABASE_URL` (default `postgres://truebatch_capsules_owner:dev@localhost:5432/truebatch_capsules_test`); each test file
gets its own schema. The test login must be able to create roles and databases (the platform test makes its own).

## On the platform
`ops/manifest.draft.json` is the draft of the product's platform manifest (permissions, back-channel logout, the
views it reads from master data and the linked products, and the views it publishes). The app reads its database from `TRUEBATCH_CAPSULES_DATABASE_URL` and runs as the restricted login
`truebatch_capsules_app`, which cannot change or delete audit rows or signatures. Migrations run as the database owner.

## Demo installations
The platform sets `TRUEBATCH_DEMO=1` only for the demo customer's installation of either product, never for a plant's
(`server/demo.ts`). Then every screen shows a DEMO banner, and a person with `truebatch_capsules.demo.skip` (packing:
`truebatch_capsules_packing.demo.skip`) sees "Skip wait (demo)" on a step that waits (a minimum time, the next periodic check, a
hold time running, a mixing time below its lower limit), which ends that wait at once. To prepare a demo from a
terminal in the product's container:

```sh
node dist/server/demo-skip.js TB260004 [stage] --as <username>           # TrueBatch Capsules
node dist/packing/server/demo-skip.js TP260001 [stage] --as <username>   # TrueBatch Capsules Packing
```

It skips every wait running now in the batch, or in one stage (its key, name or number), as the named demo person
(someone who has signed in once). Each skip is an insert-only step event `demo_wait_skipped` with who, when and which
wait, shown in the step history, QA's review and the batch record PDF as "DEMO: wait skipped by … at …"; the engine
counts that wait as satisfied, nothing else changes. Without `TRUEBATCH_DEMO=1` the button is absent, the route answers
403 and the command exits non-zero.

## Conventions
- One app: `server/` (Fastify), `web/` (React), `db/migrations/` (plain SQL), `test/`, `e2e/` (browser tests), `ops/`, `docs/`;
  `packing/` for TrueBatch Capsules Packing's own entry points and migrations.
- A test that proves a rule starts its name with the rule ID: `TC-xx` for TrueBatch Capsules rules, `PL-xx` for platform rules.
- Paraphrase regulations; never paste more than a short phrase.
- Work on a branch, CI green, one review pass, then merge.
