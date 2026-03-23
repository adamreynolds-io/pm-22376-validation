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

const mainnetRpcHost = process.env['MIDNIGHT_RPC_HOST'] ?? 'td-rpc.mainnet.midnight.network';

export const MAINNET_CONFIG: NetworkConfig = {
  networkId: 'mainnet',
  indexer: process.env['MIDNIGHT_INDEXER'] ?? 'https://indexer.mainnet.midnight.network/api/v3/graphql',
  indexerWS: process.env['MIDNIGHT_INDEXER_WS'] ?? 'wss://indexer.mainnet.midnight.network/api/v3/graphql/ws',
  node: `https://${mainnetRpcHost}`,
  nodeWS: `wss://${mainnetRpcHost}`,
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
