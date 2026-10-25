// Registers an agent for a user through the BE API with a fresh EOA, optionally verifying it (EIP-191 signature via viem).
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { API, state } from './state.mjs';
import { signAccess } from './jwt.mjs';

export async function registerAgent(userId, name, verify) {
  const call = async (method, path, body) => {
    const r = await fetch(API + path, {
      method,
      headers: { authorization: 'Bearer ' + signAccess(state.jwtSecret, userId, false), 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    return [r.status, await r.json()];
  };
  const account = privateKeyToAccount(generatePrivateKey());
  const [s1, reg] = await call('POST', '/agents', { name, description: `${name} agent description`, walletAddress: account.address });
  if (s1 !== 201) throw new Error(`register ${name}: ${s1} ${JSON.stringify(reg)}`);
  if (!verify) return reg;
  const signature = await account.signMessage({ message: reg.verificationMessage });
  const [s2, v] = await call('POST', `/agents/${reg.agentId}/verify`, { signature });
  if (s2 !== 200 && s2 !== 201) throw new Error(`verify ${name}: ${s2} ${JSON.stringify(v)}`);
  return reg;
}
