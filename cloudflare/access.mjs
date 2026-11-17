const keySets = new Map();
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const parse = value => JSON.parse(new TextDecoder().decode(decode(value)));

export function accessConfigured(env) {
  return /^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(env.CF_ACCESS_TEAM_DOMAIN || '') && !!env.CF_ACCESS_AUD;
}

/** Only a verified Access JWT may become an application identity on this host. */
export async function accessIdentity(request, env) {
  if (!accessConfigured(env)) return null;
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || cookie;
  if (!token || token.length > 16384) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = parse(parts[0]), claims = parse(parts[1]);
    const issuer = 'https://' + env.CF_ACCESS_TEAM_DOMAIN.toLowerCase();
    const now = Date.now() / 1000;
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    if (claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(env.CF_ACCESS_AUD)) return null;
    if (typeof claims.exp !== 'number' || claims.exp <= now || (claims.nbf && claims.nbf > now + 30)) return null;
    if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string' || !/^\S+@\S+\.\S+$/.test(claims.email)) return null;
    let cached = keySets.get(issuer);
    if (!cached || cached.until < Date.now()) {
      const response = await fetch(issuer + '/cdn-cgi/access/certs', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return null;
      const body = await response.json();
      if (!Array.isArray(body.keys)) return null;
      cached = { keys: body.keys, until: Date.now() + 300000 };
      keySets.set(issuer, cached);
    }
    const jwk = cached.keys.find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!valid) return null;
    return { id: 'cloudflare-access:' + claims.sub, email: claims.email.toLowerCase() };
  } catch { return null; }
}

export async function authenticatedRequest(request, env) {
  const headers = new Headers(request.headers);
  for (const key of [...headers.keys()]) if (key.startsWith('oai-authenticated-')) headers.delete(key);
  const identity = await accessIdentity(request, env);
  if (identity) {
    headers.set('oai-authenticated-user-id', identity.id);
    headers.set('oai-authenticated-user-email', identity.email);
  }
  return new Request(request, { headers });
}
