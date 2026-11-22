import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { installerDownload, installerPage } from "./installer-download.mjs";
const key = "a-test-only-capability-key",
  env = {
    LINUX_DOWNLOAD_HASH: createHash("sha256").update(key).digest("hex"),
    LINUX_DOWNLOAD_EXPIRES_AT: String(Date.now() + 86400000),
  },
  bytes = readFileSync(
    new URL("../dist/releases/cafenetyar-linux-4.0.0.zip", import.meta.url),
  ),
  payload = {
    base64: bytes.toString("base64"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
const req = (value = key, options = {}) =>
  new Request(
    "https://example.test/downloads/cafenetyar-linux-4.0.0.zip" +
      (value ? "?key=" + value : ""),
    options,
  );
test("installer is private and only a valid unexpired capability can download it", async () => {
  for (const value of ["", "wrong"])
    assert.equal(
      (await installerDownload(req(value), env, payload)).status,
      404,
    );
  assert.equal(
    (
      await installerDownload(
        req(),
        { ...env, LINUX_DOWNLOAD_EXPIRES_AT: "1" },
        payload,
      )
    ).status,
    410,
  );
  assert.equal((await installerDownload(req(), {}, payload)).status, 404);
});
test("download returns the exact installation ZIP with a filename and correct MIME, not an HTML or nested artifact archive", async () => {
  const r = await installerDownload(req(), env, payload);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/zip");
  assert.match(
    r.headers.get("content-disposition"),
    /attachment; filename="cafenetyar-linux-4.0.0.zip"/,
  );
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes);
  assert.equal(r.headers.get("content-length"), String(bytes.length));
});
test("HEAD and resumed byte ranges preserve size and contents; invalid ranges are rejected", async () => {
  const head = await installerDownload(
    req(key, { method: "HEAD" }),
    env,
    payload,
  );
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal(Number(head.headers.get("content-length")), bytes.length);
  const r = await installerDownload(
    req(key, { headers: { Range: "bytes=100-199" } }),
    env,
    payload,
  );
  assert.equal(r.status, 206);
  assert.deepEqual(
    Buffer.from(await r.arrayBuffer()),
    bytes.subarray(100, 200),
  );
  assert.equal(r.headers.get("content-range"), "bytes 100-199/" + bytes.length);
  assert.equal(
    (
      await installerDownload(
        req(key, { headers: { Range: "bytes=999999999-" } }),
        env,
        payload,
      )
    ).status,
    416,
  );
});

test("download page requires the same key and presents the actual ZIP link", async () => {
  assert.equal((await installerPage(req(""), env, payload)).status, 404);
  const page = await installerPage(req(), env, payload);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  const html = await page.text();
  assert.match(html, /download="cafenetyar-linux-4.0.0.zip"/);
  assert.ok(html.includes("/downloads/cafenetyar-linux-4.0.0.zip?key=" + key));
});
