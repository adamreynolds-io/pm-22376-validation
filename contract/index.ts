import { CompiledContract } from '@midnight-ntwrk/compact-js';
import path from 'node:path';

export {
  Contract,
  ledger,
  pureCircuits,
  State,
  type Ledger,
  type Witnesses,
  type ImpureCircuits,
  type PureCircuits,
} from './managed/bboard/contract/index.js';

import { Contract, type Witnesses, type Ledger } from './managed/bboard/contract/index.js';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type BBoardPrivateState = {
  readonly secretKey: Uint8Array;
};

export function createBBoardPrivateState(
  secretKey: Uint8Array,
): BBoardPrivateState {
  return { secretKey };
}

export const witnesses: Witnesses<BBoardPrivateState> = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, BBoardPrivateState>): [
    BBoardPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
export const zkConfigPath = path.resolve(currentDir, 'managed', 'bboard');

export const CompiledBBoardContract = CompiledContract.make(
  'BBoardContract',
  Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
