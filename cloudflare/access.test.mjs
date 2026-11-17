import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { accessIdentity, authenticatedRequest } from './access.mjs';

let pair, jwk;
const originalFetch = globalThis.fetch;
const env = { CF_ACCESS_TEAM_DOMAIN: 'fixture.cloudflareaccess.com', CF_ACCESS_AUD: 'expected-application' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
async function token(overrides = {}, header = {}) {
  const claims = { iss: 'https://' + env.CF_ACCESS_TEAM_DOMAIN, aud: [env.CF_ACCESS_AUD], exp: Date.now() / 1000 + 300, sub: 'fixture-owner', email: 'owner@example.test', ...overrides };
  const input = encode({ alg: 'RS256', kid: 'fixture-key', ...header }) + '.' + encode(claims);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(input));
  return input + '.' + Buffer.from(signature).toString('base64url');
}
before(async () => {
  pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'fixture-key' };
  globalThis.fetch = async url => {
    assert.equal(url, 'https://' + env.CF_ACCESS_TEAM_DOMAIN + '/cdn-cgi/access/certs');
    return Response.json({ keys: [jwk] });
  };
});
after(() => { globalThis.fetch = originalFetch; });

test('Cloudflare requests cannot inject Sites identity headers', async () => {
  const request = new Request('https://fixture.workers.dev/api/session', { headers: { 'oai-authenticated-user-id': 'spoofed', 'oai-authenticated-user-email': 'owner@example.test' } });
  const clean = await authenticatedRequest(request, env);
  assert.equal(clean.headers.get('oai-authenticated-user-id'), null);
  assert.equal(clean.headers.get('oai-authenticated-user-email'), null);
});
test('a correctly signed Access token supplies the verified identity', async () => {
  const request = new Request('https://fixture.workers.dev/api/session', { headers: { 'Cf-Access-Jwt-Assertion': await token(), 'oai-authenticated-user-id': 'spoofed' } });
  const trusted = await authenticatedRequest(request, env);
  assert.equal(trusted.headers.get('oai-authenticated-user-id'), 'cloudflare-access:fixture-owner');
  assert.equal(trusted.headers.get('oai-authenticated-user-email'), 'owner@example.test');
});
test('the Access cookie carries verified identity to the same-origin API', async () => {
  const request = new Request('https://fixture.workers.dev/api/me', { headers: { cookie: 'other=1; CF_Authorization=' + await token() } });
  assert.equal((await accessIdentity(request, env)).id, 'cloudflare-access:fixture-owner');
});
for (const [label, claims, header] of [
  ['expired', { exp: Date.now() / 1000 - 60 }, {}],
  ['wrong audience', { aud: ['other-application'] }, {}],
  ['wrong issuer', { iss: 'https://other.cloudflareaccess.com' }, {}],
  ['future not-before', { nbf: Date.now() / 1000 + 600 }, {}],
  ['missing email', { email: null }, {}],
  ['unsigned algorithm', {}, { alg: 'none' }],
  ['unknown key', {}, { kid: 'unknown' }],
]) test('Access rejects ' + label, async () => {
  const request = new Request('https://fixture.workers.dev/api/me', { headers: { 'Cf-Access-Jwt-Assertion': await token(claims, header) } });
  assert.equal(await accessIdentity(request, env), null);
});
test('a modified signature cannot authenticate', async () => {
  const signed = await token();
  const parts = signed.split('.');
  parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  assert.equal(await accessIdentity(new Request('https://fixture.workers.dev/api/me', { headers: { 'Cf-Access-Jwt-Assertion': parts.join('.') } }), env), null);
});
test('unconfigured Access fails closed and does not retain a forged identity', async () => {
  const request = new Request('https://fixture.workers.dev/api/me', { headers: { 'oai-authenticated-user-id': 'spoofed', 'Cf-Access-Jwt-Assertion': await token() } });
  const trusted = await authenticatedRequest(request, {});
  assert.equal(trusted.headers.get('oai-authenticated-user-id'), null);
});
