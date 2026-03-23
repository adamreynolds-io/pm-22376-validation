/**
 * PM-22376 Validation: Deploy and call bboard contract via midnight-js.
 *
 * Confirms whether the "node must be present" panic is toolkit-only
 * or also affects the midnight-js/indexer code path.
 *
 * midnight-js uses the indexer (pre-indexed GraphQL) for state,
 * bypassing the toolkit's Rust arena/block-replay entirely.
 *
 * Run against local:   yarn test
 * Run against mainnet: MIDNIGHT_NETWORK=mainnet MIDNIGHT_SEED=<seed> yarn test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { randomBytes } from 'node:crypto';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  deployContract,
  submitCallTx,
} from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/compact-runtime';
import pino from 'pino';

import { getConfig } from '../config.js';
import { MidnightWalletProvider, syncWallet } from '../wallet.js';
import { buildProviders, type BBoardProviders } from '../providers.js';
import {
  CompiledBBoardContract,
  createBBoardPrivateState,
  ledger,
  State,
  zkConfigPath,
} from '../../contract/index.js';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';

// Required for GraphQL subscriptions in Node.js
// @ts-expect-error WebSocket global assignment for apollo
globalThis.WebSocket = WebSocket;

// Genesis seed for local dev node — pre-funded with tokens
const LOCAL_DEV_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';

const PRIVATE_STATE_ID = 'bboardPrivateState';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

function elapsed(start: number): string {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  logger.info(`[${label}] starting...`);
  try {
    const result = await fn();
    logger.info(`[${label}] completed in ${elapsed(start)}`);
    return result;
  } catch (err) {
    logger.error(`[${label}] failed after ${elapsed(start)}: ${err}`);
    throw err;
  }
}

describe('PM-22376: bboard contract via midnight-js', () => {
  let wallet: MidnightWalletProvider;
  let providers: BBoardProviders;
  let contractAddress: ContractAddress;

  const config = getConfig();
  const isMainnet = config.networkId === 'mainnet';
  const seed = isMainnet
    ? process.env['MIDNIGHT_SEED']
    : (process.env['MIDNIGHT_SEED'] ?? LOCAL_DEV_SEED);

  beforeAll(async () => {
    if (isMainnet && !process.env['MIDNIGHT_SEED']) {
      logger.warn('MIDNIGHT_SEED not set — skipping mainnet tests');
      return;
    }

    logger.info(`Network: ${config.networkId}`);
    logger.info(`Indexer: ${config.indexer}`);
    logger.info(`Node: ${config.node}`);
    logger.info(`Proof server: ${config.proofServer}`);
    setNetworkId(config.networkId);

    const envConfig: EnvironmentConfiguration = {
      walletNetworkId: config.networkId,
      networkId: config.networkId,
      indexer: config.indexer,
      indexerWS: config.indexerWS,
      node: config.node,
      nodeWS: config.nodeWS,
      faucet: config.faucet,
      proofServer: config.proofServer,
    };

    wallet = await timed('wallet-build', () =>
      MidnightWalletProvider.build(logger, envConfig, seed!),
    );
    await timed('wallet-start', () => wallet.start());
    await timed('wallet-sync', () =>
      syncWallet(logger, wallet.wallet, 600_000),
    );

    providers = buildProviders(wallet, zkConfigPath, config);
    logger.info('Providers initialized. Ready to test.');
  }, 15 * 60_000);

  afterAll(async () => {
    if (wallet) {
      logger.info('Stopping wallet...');
      await wallet.stop();
    }
  });

  it.skipIf(isMainnet && !process.env['MIDNIGHT_SEED'])(
    'deploy bboard contract',
    async () => {
      const initialPrivateState = createBBoardPrivateState(randomBytes(32));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deployed: any = await timed('deploy', () =>
        (deployContract as any)(providers, {
          compiledContract: CompiledBBoardContract,
          privateStateId: PRIVATE_STATE_ID,
          initialPrivateState,
          args: [],
        }),
      );

      contractAddress = deployed.deployTxData.public.contractAddress;
      logger.info(`Contract address: ${contractAddress}`);
      logger.info(
        `Deploy tx hash: ${deployed.deployTxData.public.txHash}`,
      );
      logger.info(
        `Deploy block height: ${deployed.deployTxData.public.blockHeight}`,
      );
      expect(contractAddress).toBeDefined();
      expect(contractAddress.length).toBeGreaterThan(0);
    },
    10 * 60_000,
  );

  it.skipIf(isMainnet && !process.env['MIDNIGHT_SEED'])(
    'call post() circuit',
    async () => {
      expect(contractAddress).toBeDefined();

      const message = `PM-22376 validation ${new Date().toISOString()}`;
      logger.info(`Message: "${message}"`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txData: any = await timed('post', () =>
        (submitCallTx as any)(providers, {
          compiledContract: CompiledBBoardContract,
          contractAddress,
          privateStateId: PRIVATE_STATE_ID,
          circuitId: 'post',
          args: [message],
        }),
      );

      logger.info(`post() tx hash: ${txData.public.txHash}`);
      logger.info(`post() block height: ${txData.public.blockHeight}`);
      logger.info(`post() status: ${txData.public.status}`);

      // Verify state changed via indexer
      const contractState = await timed('post-verify', () =>
        providers.publicDataProvider.queryContractState(contractAddress),
      );
      expect(contractState).not.toBeNull();
      const state = ledger(contractState!.data);
      logger.info(
        `Ledger state: state=${state.state}, message="${state.message?.value}", sequence=${state.sequence}`,
      );
      expect(state.state).toBe(State.OCCUPIED);
      expect(state.message.is_some).toBe(true);
    },
    10 * 60_000,
  );

  it.skipIf(isMainnet && !process.env['MIDNIGHT_SEED'])(
    'call takeDown() circuit',
    async () => {
      expect(contractAddress).toBeDefined();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txData: any = await timed('takeDown', () =>
        (submitCallTx as any)(providers, {
          compiledContract: CompiledBBoardContract,
          contractAddress,
          privateStateId: PRIVATE_STATE_ID,
          circuitId: 'takeDown',
          args: [],
        }),
      );

      logger.info(`takeDown() tx hash: ${txData.public.txHash}`);
      logger.info(`takeDown() block height: ${txData.public.blockHeight}`);
      logger.info(`takeDown() status: ${txData.public.status}`);

      // Verify state returned to VACANT
      const contractState = await timed('takeDown-verify', () =>
        providers.publicDataProvider.queryContractState(contractAddress),
      );
      expect(contractState).not.toBeNull();
      const state = ledger(contractState!.data);
      logger.info(
        `Ledger state: state=${state.state}, sequence=${state.sequence}`,
      );
      expect(state.state).toBe(State.VACANT);
      expect(state.message.is_some).toBe(false);
    },
    10 * 60_000,
  );
});
