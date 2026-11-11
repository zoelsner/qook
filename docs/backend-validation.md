# Backend and native validation

GitHub Actions runs backend and native checks for pull requests to `main` or
`phase3a-wiring`, pushes to those branches and `codex/**`, and manual dispatch.
Each job has a ten-minute timeout. The workflow has read-only repository
permissions, uses pinned action revisions, and contains no deployment step or
production credentials.

## Backend

Use Deno 2.9.1 and Python 3 from the repository root:

```sh
sh scripts/qa/run-backend-tests.sh cache
sh scripts/qa/run-backend-tests.sh check
sh scripts/qa/run-backend-tests.sh test
```

The cache step downloads public dependencies using the frozen
`supabase/functions/deno.lock`. It does not execute handlers. The check step
typechecks every Edge Function entry point with `deno test --no-run`. Tests use
the existing dependency cache and deny network access; HTTP tests intercept
requests with synthetic fixtures. No provider account or Supabase project is
needed. The legacy persistence suite is loaded through a wrapper that suppresses
its imported HTTP listener.

The isolated backend lock retains the already-tested Supabase SDK 2.110.0
resolution. It deliberately avoids resolving the native workspace dependencies
or silently upgrading the SDK. Production imports currently allow SDK major
version 2; use an explicitly reviewed lock/dependency change when changing this
test baseline. The same optimization suite was also checked locally against
SDKs 2.111.0 and 2.112.0 observed in the deployed function bundles.

## Native

Use Node 22.23.1 and Bun 1.3.14:

```sh
bun install --frozen-lockfile
cd apps/native
bun run test
bun run typecheck
bun run lint
```

These checks cover unit behavior and static validation. They do not build a
signed iOS app or exercise Apple sign-in, device rendering, or a live backend.

## Before any production deployment

Verify proposal-to-fill behavior in staging, including old cards without a
saved brief, cache redirects, private requirements, and generation failures.
Old cards without a private brief fail closed and require a new dinner idea.
Confirm the intended generation quotas, model secrets, and rollback procedure.

Concurrent fills and quota checks still lack atomic database coordination.
Whole-route database/cleanup deadlines and complete stored-equipment enforcement
remain follow-up work. Synthetic cache timing improvements do not establish
production latency or provider billing savings.

## Proposal read preflight and evaluation fixtures

Proposal authentication, request parsing, preferences, brief validation and quota
reads share a 15-second application deadline. Failed preference reads and missing
quota counts fail closed before reservation or payment. A genuinely absent
preferences row still uses the existing defaults. Authentication failures retain
401; infrastructure failures/cancellation return a generic 503, and deadline
expiry returns 504. The budget needs staging calibration and is not a whole-route
latency promise or a spend cap.

The read client combines query/request cancellation and stops new underlying
fetches after expiry. PostgREST reads also receive `.abortSignal(...)` so SDK retry
sleep can end on cancellation. The complete read phase races the deadline,
including response-body consumption and transports that ignore cancellation.
Late read completion cannot resume the handler's write path. A separate mutation
client receives no preflight deadline; write and cleanup uncertainty is deferred.

`supabase/functions/qa/culinary-cases.json` holds eleven concrete context,
ingredient and manual-review cases. The associated tests cover serving/time
language, named onion forms, diet/allergy controls, and a proposal-to-fill-to-reopen
flow using the real handlers and SDK with intercepted HTTP. Fixtures are handwritten
and do not measure model quality, nutrition accuracy, food safety or actual cooking.

Tests explicitly named `KNOWN GAP` characterize current unwanted behavior:
concurrent fills call the provider twice; two quota checks at nine can both pass;
stored equipment and feasible overlapping cooking timelines are incompletely
enforced.
Their passing status means those gaps were reproduced, not fixed. Update their
expectations when implementing the desired behavior.

These fixtures use in-memory state and do not verify PostgreSQL transaction
isolation, unique indexes, RLS, durable replay, or ambiguous-commit reconciliation.
No local Postgres/Docker is available in this environment, and this increment
introduces no SQL migration or production-ready database protocol.

## Association and cleanup failure boundaries

Once a proposal attempts to insert its private generation items, all subsequent
errors preserve recipes, associations, and session state. An association or ready
write can commit even if its acknowledgement is lost; cleanup must not assume
failure. The handler returns its existing sanitized 500 and logs metadata-only
`publication_uncertain` diagnostics. It does not reconcile the outcome, replay
the response, or mark a retained generating session failed.

Before attempting associations, cleanup first requests a conditional transition
of the identified session from `generating` to `failed`, returning its ID. Only
exactly one matching returned ID permits deletion of the tracked skeleton IDs,
filtered to `content_status = proposal`. Unknown/failed/no-match transitions
retain recipes; full rows and untracked cache rows are excluded from deletion.
These global skeletons can already be readable before session association.

A failed fill records its generic retry error only on a still-proposal recipe,
so a late failed request cannot add an error to a concurrently completed full
recipe. This does not coalesce provider calls or prevent competing full writes.

The actual handler/SDK fixtures enforce emitted filters against in-memory state
and cover committed/rejected/unknown associations, ready acknowledgement loss,
failed/missing final reads, a fill completing during proposal failure, conditional
cleanup, and late failed fills. PostgreSQL/RLS semantics remain unvalidated.
No local PostgreSQL or container runtime is installed; no test database was
created and no migration is included.

Conservative retention can leave orphan recipes and quota-counted `generating`
sessions, including definite association rejections. Automatic client retries
can still buy another hand. Durable reconciliation, replay/coalescing, atomic
quota reservation, retention policy, and mutation deadlines require separate
design and real database validation before implementation or rollout.

## Consistent dish contract (local, 2026-10-25)

New proposals produce `dishContract` in their existing structured response:
version 1, visible components with exact proposal ingredient references, finished
forms and appearance, plus food arrangement. `recipes.dish_contract` stores only
this public culinary identity. Private preferences and context stay on the
session-owned generation item. Full recipe generation receives the same saved
identity; fill compares private/public contracts before cache or provider work,
and never overwrites the dish contract or independently generated image.

Image generation uses the saved identity directly, without a plate-description
text call. Existing null/missing contracts use their ingredient/method data;
malformed non-null identities fail before claiming a paid attempt. The original
canon reference, composition, first-three prefetch, and first-art wait remain.
Specified food colors take precedence over illustration palette defaults.

Validation for this change:

- 214 offline backend tests pass, including the actual proposal → saved contract
  → image → full recipe → repeated-image handlers with intercepted HTTP. The
  fixture buys one image response and one recipe fill, with no text description.
- 171 native unit tests, native typecheck/lint, and all six Edge Function entry
  point typechecks pass.
- The additive migration was applied to an isolated in-memory PostgreSQL WASM
  runtime (`@electric-sql/pglite` 0.5.11) outside the repository. Fifteen SQL
  assertions cover legacy SQL NULL, valid version-1 data, invalid roots/versions,
  updates, comments, and retention of an existing RLS-enabled flag. This does not
  establish hosted Supabase/RLS behavior or simulate the complete production DB.
- `GenerationLoadingScreen.tsx` matches this task's starting copy byte-for-byte;
  image prefetch and reveal timing were not changed.

Runtime schema checks validate structure and ingredient references, with narrow
ingredient-scoped guards for explicit form changes. Free-form appearance/plating
and actual generated image fidelity still need a small live culinary/art sample;
these tests do not establish full semantic or food-safety verification.

Rollout remains gated. Apply
`20261025142739_consistent_dish_contract.sql` before the coordinated
`generate-proposals`, `fill-recipe`, and `generate-image` bundles. Include the
existing private-brief rollout requirements: older proposal cards without a saved
private brief are still rejected deliberately. Regenerate the gitignored DB
types after applying the migration. Production was not changed, and no new paid
model/image requests, pushes or merges were performed.
