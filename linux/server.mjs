import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { isIP } from "node:net";
import { openDatabase } from "./database.mjs";
import app from "../native/composed-server.mjs";
import {
  query,
  one,
  credentialStatements,
  workspaceStatements,
  phoneNumber,
} from "../native/identity.mjs";
export { openDatabase };
export { unassignedWorkspaces } from "../native/identity.mjs";
export function environment(overrides = {}) {
  return {
    ...process.env,
    AUTH_PASSWORD_ITERATIONS: process.env.AUTH_PASSWORD_ITERATIONS || "600000",
    ...overrides,
  };
}
export function database(env = environment()) {
  return openDatabase(
    env.DB_FILE || "./data/cafenetyar.sqlite",
    env.MIGRATIONS_DIR || fileURLToPath(new URL("./drizzle", import.meta.url)),
  );
}
export async function bootstrapOwner(db, input, env = environment()) {
  const phone = phoneNumber(input.phone);
  if (!phone) throw new Error("شماره موبایل معتبر نیست.");
  const existing = await one(db, "SELECT * FROM accounts WHERE role='owner'");
  if (existing && existing.phone !== phone)
    throw new Error("مالک از قبل ثبت شده است؛ شمارهٔ همان مالک را وارد کنید.");
  const owner = existing || {
    id: crypto.randomUUID(),
    phone,
    name: input.name || "مالک کافی‌نت‌یار",
  };
  const creds = await credentialStatements(db, owner, input, env),
    statements = [];
  if (!existing)
    statements.push(
      query(
        db,
        "INSERT INTO accounts(id,email,phone,name,role,created_at) VALUES(?,?,?,?,'owner',?)",
        owner.id,
        "owner@accounts.local",
        phone,
        owner.name,
        Date.now(),
      ),
    );
  statements.push(
    ...(await workspaceStatements(db, owner.id, input)),
    ...creds.statements,
    query(db, "DELETE FROM sessions WHERE user_id=?", owner.id),
  );
  await db.batch(statements);
  return { id: owner.id, recoveryCode: creds.code };
}
export function startServer(env = environment(), store = database(env)) {
  if (env.NODE_ENV === "production" && !env.PUBLIC_ORIGIN)
    throw new Error("PUBLIC_ORIGIN را با آدرس HTTPS دامنه تنظیم کنید.");
  if (env.PUBLIC_ORIGIN) {
    const u = new URL(env.PUBLIC_ORIGIN);
    if (env.NODE_ENV === "production" && u.protocol !== "https:")
      throw new Error("در محیط واقعی PUBLIC_ORIGIN باید HTTPS باشد.");
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.pathname !== "/" ||
      u.username ||
      u.password
    )
      throw new Error("PUBLIC_ORIGIN باید فقط مبدأ دامنه باشد.");
  }
  if (
    !store.sqlite.prepare("SELECT id FROM accounts WHERE role='owner'").get() &&
    !env.SETUP_TOKEN
  ) {
    const tokenPath = resolve(dirname(store.path), "setup-token");
    mkdirSync(dirname(tokenPath), { recursive: true, mode: 0o700 });
    if (!existsSync(tokenPath))
      writeFileSync(tokenPath, crypto.randomUUID() + crypto.randomUUID(), {
        mode: 0o600,
        flag: "wx",
      });
    env = { ...env, SETUP_TOKEN: readFileSync(tokenPath, "utf8").trim() };
    console.log(
      "کد راه‌اندازی خصوصی در فایل " +
        tokenPath +
        " است. صفحه /install را باز کنید.",
    );
  }
  const server = createServer(async (req, res) => {
    try {
      const origin = env.PUBLIC_ORIGIN || "http://" + req.headers.host;
      if (
        !env.PUBLIC_ORIGIN &&
        !["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)
      ) {
        res.writeHead(400);
        res.end("PUBLIC_ORIGIN is required");
        return;
      }
      const path = new URL(req.url, origin).pathname;
      if (path === "/signin-with-chatgpt" || path === "/signout-with-chatgpt") {
        res.writeHead(302, { Location: "/auth?returnTo=%2Fmanage" });
        res.end();
        return;
      }
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (
          k.startsWith("oai-") ||
          k.startsWith("cf-") ||
          k.startsWith("x-forwarded-") ||
          [
            "host",
            "connection",
            "transfer-encoding",
            "content-length",
          ].includes(k)
        )
          continue;
        if (v !== undefined)
          headers.set(k, Array.isArray(v) ? v.join(", ") : v);
      }
      let ip = req.socket.remoteAddress || "local";
      if (
        env.TRUST_PROXY === "1" &&
        ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip)
      ) {
        const forwarded = String(req.headers["x-forwarded-for"] || "")
          .split(",")[0]
          .trim();
        if (isIP(forwarded)) ip = forwarded;
      }
      headers.set("cf-connecting-ip", ip);
      let body;
      if (!["GET", "HEAD"].includes(req.method)) {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1500000) {
            res.writeHead(413);
            res.end("Request too large");
            return;
          }
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks);
      }
      const request = new Request(new URL(req.url, origin), {
        method: req.method,
        headers,
        ...(body ? { body } : {}),
      });
      const response = await app.fetch(request, { ...env, DB: store.DB }, {});
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(
        req.method === "HEAD"
          ? undefined
          : Buffer.from(await response.arrayBuffer()),
      );
    } catch (error) {
      res.writeHead(500, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({ error: "خطای داخلی سرور؛ گزارش سرور را بررسی کنید." }),
      );
      console.error("Request failed:", error.name);
    }
  });
  server.on("close", () => store.close());
  server.listen(Number(env.PORT || 3000), env.HOST || "127.0.0.1");
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const env = environment(),
    server = startServer(env);
  server.on("listening", () =>
    console.log(
      "کافی‌نت‌یار روی " +
        (env.PUBLIC_ORIGIN || "http://127.0.0.1:" + server.address().port) +
        " اجرا شد.",
    ),
  );
  const stop = () => server.close(() => process.exit(0));
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
