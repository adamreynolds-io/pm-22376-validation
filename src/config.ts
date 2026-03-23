export type NetworkConfig = {
  networkId: string;
  indexer: string;
  indexerWS: string;
  node: string;
  nodeWS: string;
  proofServer: string;
  faucet: string;
};

export const LOCAL_CONFIG: NetworkConfig = {
  networkId: 'undeployed',
  indexer: 'http://localhost:8088/api/v4/graphql',
  indexerWS: 'ws://localhost:8088/api/v4/graphql/ws',
  node: 'http://localhost:9944',
  nodeWS: 'ws://localhost:9944',
  proofServer: 'http://localhost:6300',
  faucet: '',
};

export const MAINNET_CONFIG: NetworkConfig = {
  networkId: 'mainnet',
  indexer: 'https://indexer.mainnet.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.mainnet.midnight.network/api/v3/graphql/ws',
  node: 'https://rpc.mainnet.midnight.network',
  nodeWS: 'wss://rpc.mainnet.midnight.network',
  proofServer: process.env['PROOF_SERVER_URL'] ?? 'http://localhost:6300',
  faucet: '',
};

export function getConfig(): NetworkConfig {
  const network = process.env['MIDNIGHT_NETWORK'] ?? 'local';
  switch (network) {
    case 'mainnet':
      return MAINNET_CONFIG;
    case 'local':
      return LOCAL_CONFIG;
    default:
      throw new Error(`Unknown network: ${network}. Use 'local' or 'mainnet'.`);
  }
}
