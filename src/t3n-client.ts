/**
 * T3N ADK connection.
 *
 * Real mode   — T3N_API_KEY set: authenticates against the T3N testnet cluster
 *               using the documented Quickstart path (eth_get_address →
 *               T3nClient → handshake → authenticate) and returns the tenant DID.
 *               `trustAnchor` uses `{ unsafe_trust_server: true }` because the
 *               live testnet manifest is missing `rtmr1_allowlist`, which SDK
 *               v5.10.0's `isSignedTrustManifest()` requires — see README / BUGS.
 * Mock mode   — T3N_API_KEY unset: skips the cluster handshake entirely and
 *               returns a deterministic local DID so the agent is runnable and
 *               testable without a provisioned key.
 */
import {
  T3nClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
} from '@terminal3/t3n-sdk';

export interface T3nSession {
  did: string;
  mode: 'live' | 'mock';
  client?: T3nClient;
}

export async function connect(env: string = 'testnet'): Promise<T3nSession> {
  const apiKey = process.env.T3N_API_KEY;
  if (!apiKey) {
    // Mock mode — deterministic, no network, same output shape.
    return { did: 'did:t3n:mock-local-agent', mode: 'mock' };
  }

  setEnvironment(env as 'testnet' | 'production');
  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(apiKey);

  const client = new T3nClient({
    // Workaround for the rtmr1_allowlist manifest bug — see README "Known issues".
    trustAnchor: { unsafe_trust_server: true },
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, apiKey) },
  });

  await client.handshake();
  const did = await client.authenticate(createEthAuthInput(address));
  return { did: did.value, mode: 'live', client };
}
