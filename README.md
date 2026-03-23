# PM-22376 Validation: bboard contract via midnight-js

Standalone test harness to validate whether the toolkit panic `PanicError("node must be present")` ([PM-22376](https://shielded.atlassian.net/browse/PM-22376)) is toolkit-specific or also affects the midnight-js/indexer code path.

## Background

The midnight-node-toolkit panics at `midnight-storage-core/arena.rs:1784` when deploying/calling a bboard Compact contract on mainnet. The root cause ([PR #1049](https://github.com/midnightntwrk/midnight-node/pull/1049)) is that trusted deserialization wraps all child nodes as `ArenaKey::Ref`, but small nodes (under `SMALL_OBJECT_LIMIT`) should be `ArenaKey::Direct`.

**midnight-js uses the indexer** (pre-indexed GraphQL) for state retrieval, completely bypassing the toolkit's Rust arena/block-replay code. If these tests pass on mainnet, the bug is confirmed toolkit-only.

## Test Flow

1. Build wallet from seed
2. Deploy bboard contract
3. Call `post()` circuit — writes message to ledger
4. Call `takeDown()` circuit — removes message
5. Verify state via indexer after each step

## Prerequisites

- Node.js >= 22
- Docker (for local proof server / full local stack)
- Yarn 1.x

## Run Against Local Network

```bash
yarn install
yarn env:up              # Start node + indexer + proof-server
yarn test:local          # Run tests
yarn env:down            # Tear down
```

## Run Against Mainnet

Requires a funded mainnet wallet seed and a local proof server.

```bash
yarn install
docker compose up -d proof-server     # Start proof server only
MIDNIGHT_NETWORK=mainnet MIDNIGHT_SEED=<hex-seed> yarn test
docker compose down
```

## Recompile Contract (Optional)

The compiled contract artifacts are included. To recompile:

```bash
compact compile +0.30.0 contract/bboard.compact contract/managed/bboard
```

## Expected Results

| Outcome | Meaning |
|---------|---------|
| All tests pass | Bug is toolkit-only. PR #1049 fix scope confirmed. |
| Fails at deploy/call | Deeper issue beyond toolkit — check indexer logs. |
| Fails at wallet sync | Network/funding issue, unrelated to the bug. |

## Local Test Results

```
✓ deploy bboard contract          20001ms
✓ call post() circuit             17173ms
✓ call takeDown() circuit         17382ms

Test Files  1 passed (1)
Tests       3 passed (3)
Duration    86.52s
```

## SDK Versions

| Package | Version |
|---------|---------|
| midnight-js-contracts | 4.0.1 |
| ledger-v8 | 8.0.3 |
| testkit-js | 4.0.1 |
| compact-runtime | 0.15.0 |
| compactc | 0.30.0 |

## Related

- [PM-22376](https://shielded.atlassian.net/browse/PM-22376) — Jira ticket
- [midnight-node PR #1049](https://github.com/midnightntwrk/midnight-node/pull/1049) — Toolkit fix
- [midnight-ledger PR #230](https://github.com/midnightntwrk/midnight-ledger/pull/230) — Upstream ledger fix
