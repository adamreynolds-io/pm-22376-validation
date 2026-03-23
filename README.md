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

Each step logs timing, tx hash, block height, and status.

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

## Debug Mode

For full diagnostics including wallet sync progress, sub-wallet states, and operation timing:

```bash
LOG_LEVEL=debug MIDNIGHT_NETWORK=local yarn test
```

Example output:

```
[wallet-sync] starting...
Wallet sync [1]:  shielded=false, unshielded=false, dust=false
  shielded.progress: {"appliedIndex":0,"highestRelevantWalletIndex":0,"isConnected":false}
Wallet sync [14]: shielded=true,  unshielded=true,  dust=false
  dust.progress: {"appliedIndex":49,"highestRelevantWalletIndex":128,"isConnected":true}
Wallet sync [22]: shielded=true,  unshielded=true,  dust=true
Wallet sync complete after 22 emissions
[wallet-sync] completed in 0.6s

[deploy] starting...
[deploy] completed in 18.2s
Contract address: 9fd03b42...
Deploy tx hash: eb29a4c5...
Deploy block height: 6

[post] starting...
[post] completed in 17.2s
post() tx hash: 13de69d4...
post() block height: 9
post() status: SucceedEntirely
Ledger state: state=1, message="PM-22376 validation ...", sequence=1
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
✓ deploy bboard contract          18218ms
✓ call post() circuit             17175ms
✓ call takeDown() circuit         18707ms

Test Files  1 passed (1)
Tests       3 passed (3)
Duration    56.17s
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
