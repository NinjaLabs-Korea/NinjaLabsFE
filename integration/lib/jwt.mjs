// HS256 access tokens signed with the run's generated JWT_SECRET (for API calls outside the browser).
import { createHmac } from 'node:crypto';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Access token for `sub`; `iatOffset` < 0 back-dates it (e.g. -3600 with ttl 600 = already expired). */
export function signAccess(secret, sub, adm, ttlSec = 600, iatOffset = 0) {
  const iat = Math.floor(Date.now() / 1000) + iatOffset;
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ sub, adm, typ: 'access', iat, exp: iat + ttlSec });
  return `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
}
