import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../dist/server/index.js';

const origin = 'https://example.test';
const original = readFileSync(new URL('../source/dist/index.html', import.meta.url), 'utf8');
test('root and original dashboard routes serve the original app, not management', async () => {
  for (const path of ['/', '/dashboard', '/dashboard/accounting', '/dashboard/employees', '/dashboard/subscription', '/p/plans']) {
    const response = await worker.fetch(new Request(origin + path), {});
    assert.equal(response.status, 200);
    assert.equal(await response.text(), original, path);
  }
});
test('the original entry asset is served byte for byte with JavaScript MIME', async () => {
  const path = original.match(/src="(\/assets\/index-[^"]+\.js)"/)[1];
  const response = await worker.fetch(new Request(origin + path), {});
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), readFileSync(new URL('../source/dist' + path, import.meta.url)));
});
test('management is separate and original admin links redirect to it', async () => {
  const response = await worker.fetch(new Request(origin + '/manage'), {});
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.notEqual(html, original);
  assert.match(html, /ورود به پنل/);
  for (const path of ['/admin', '/admin/users', '/super-admin']) {
    const redirect = await worker.fetch(new Request(origin + path), {});
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), origin + '/manage');
  }
});

test('download directory points to the current repository and favicon resolves', async () => {
  const response = await worker.fetch(new Request(origin + '/downloads/'), {});
  assert.match(await response.text(), /https:\/\/github.com\/mrayoubp\/cafenetyar/);
  const icon = await worker.fetch(new Request(origin + '/favicon.ico'), {});
  assert.equal(icon.status, 302);
  const svg = await worker.fetch(new Request(icon.headers.get('location')), {});
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get('content-type'), /image\/svg/);
});
