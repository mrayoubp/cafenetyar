import {
  LEGACY,
  assertAdmission,
  remoteCall,
  resolveLogin,
  rateLimit,
} from "./site-access.mjs";
const denied = new Set([
  "authActions:registerOwner",
  "authActions:createEmployee",
  "tenancy:completeOwnerSetup",
]);
const fail = (message, status = 403) => {
  throw Object.assign(new Error(message), { status });
};
const normalized = (p) => String(p ?? "").replace(/\.js:/, ":");
export function isConvexPath(path) {
  return (
    ["/api/query", "/api/mutation", "/api/action"].includes(path) ||
    /^\/api\/[^/]+\/sync$/.test(path)
  );
}
export async function authorizeRpc(
  path,
  args,
  kind,
  state,
  env,
  ip = "unknown",
  transport = fetch,
) {
  path = normalized(path);
  if (
    denied.has(path) ||
    (path.startsWith("managedAccounts:") &&
      path !== "managedAccounts:revokeAllSessions" &&
      path !== "managedAccounts:recordSession")
  )
    fail("ساخت حساب و کارمند فقط از پنل اصلی صاحب سایت مجاز است.");
  if (state.context) await assertAdmission(env.DB, env, state.context);
  if (path === "auth:signIn") {
    if (args?.refreshToken) return;
    if (args?.provider !== "password" || args?.params?.flow !== "signIn")
      fail("ثبت‌نام عمومی بسته است؛ حساب را از مدیر دریافت کنید.");
    const email = String(args.params.email || "");
    if (!email.endsWith("@phone.kafinet.local"))
      fail("شناسهٔ ورود معتبر نیست.");
    await resolveLogin(
      env.DB,
      env,
      email.slice(0, -"@phone.kafinet.local".length),
    );
    await rateLimit(env.DB, "password:" + ip, 30);
    return;
  }
  if (path === "auth:signOut") return;
  if (path === "authActions:resetPasswordWithRecovery") {
    await resolveLogin(env.DB, env, args?.phone);
    await rateLimit(env.DB, "recovery:" + ip, 10);
    return;
  }
  if (kind !== "query" && !state.context) fail("ابتدا وارد حساب شوید.", 401);
}
async function authenticate(token, env, transport) {
  const context = await remoteCall(
    "tenancy:myContext",
    {},
    token,
    "query",
    transport,
  );
  await assertAdmission(env.DB, env, context);
  return context;
}
export async function authorizeMessage(
  message,
  state,
  env,
  ip,
  transport = fetch,
) {
  if (message.componentPath || message.impersonating)
    fail("دسترسی به این بخش مجاز نیست.");
  if (message.type === "Authenticate") {
    if (message.tokenType === "None") {
      state.context = null;
      return;
    }
    if (
      message.tokenType !== "User" ||
      typeof message.value !== "string" ||
      message.value.length > 20000
    )
      fail("نشست معتبر نیست.", 401);
    state.context = await authenticate(message.value, env, transport);
    return;
  }
  if (state.context) await assertAdmission(env.DB, env, state.context);
  if (message.type === "ModifyQuerySet") {
    if (
      !Array.isArray(message.modifications) ||
      message.modifications.length > 2000
    )
      fail("درخواست معتبر نیست.", 400);
    for (const m of message.modifications)
      if (m.type === "Add") {
        if (m.componentPath) fail("دسترسی مجاز نیست.");
        await authorizeRpc(
          m.udfPath,
          m.args?.[0],
          "query",
          state,
          env,
          ip,
          transport,
        );
      }
    return;
  }
  if (message.type === "Action" || message.type === "Mutation")
    return authorizeRpc(
      message.udfPath,
      message.args?.[0],
      message.type.toLowerCase(),
      state,
      env,
      ip,
      transport,
    );
  if (!["Connect", "Event"].includes(message.type))
    fail("درخواست معتبر نیست.", 400);
}
export async function convexProxy(request, env, ctx, transport = fetch) {
  const url = new URL(request.url),
    origin = request.headers.get("origin");
  const error = (e) =>
    Response.json(
      {
        status: "error",
        errorMessage: e.status < 500 ? e.message : "ارتباط با سرور برقرار نشد.",
        errorData: {
          message: e.status < 500 ? e.message : "ارتباط با سرور برقرار نشد.",
        },
      },
      { status: e.status || 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    if (!env.DB) fail("دیتابیس متصل نیست.", 503);
    if (origin !== url.origin) fail("مبدأ درخواست معتبر نیست.");
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const upstream = await transport(LEGACY + url.pathname, {
        headers: { Upgrade: "websocket" },
      });
      if (!upstream.webSocket) fail("ارتباط زنده برقرار نشد.", 503);
      const pair = new WebSocketPair(),
        client = pair[0],
        server = pair[1],
        remote = upstream.webSocket;
      server.accept();
      remote.accept();
      const state = { context: null };
      let queue = Promise.resolve(),
        closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          server.close(1008, "دسترسی یا ارتباط پایان یافت.");
        } catch {}
        try {
          remote.close(1000);
        } catch {}
      };
      server.addEventListener("message", (event) => {
        queue = queue
          .then(async () => {
            let message;
            try {
              if (typeof event.data !== "string" || event.data.length > 1500000)
                fail("حجم درخواست زیاد است.", 413);
              message = JSON.parse(event.data);
              await authorizeMessage(message, state, env, ip, transport);
              remote.send(event.data);
            } catch (e) {
              if (message && ["Action", "Mutation"].includes(message.type))
                server.send(
                  JSON.stringify({
                    type: message.type + "Response",
                    requestId: message.requestId,
                    success: false,
                    result:
                      e.status < 500
                        ? e.message
                        : "ارتباط برقرار نشد؛ دوباره تلاش کنید.",
                    logLines: [],
                  }),
                );
              else if (message?.type === "Authenticate") {
                state.context = null;
                server.send(
                  JSON.stringify({
                    type: "AuthError",
                    error: "حساب اجازهٔ ورود ندارد؛ با مدیر تماس بگیرید.",
                    baseVersion: message.baseVersion,
                    authUpdateAttempted: true,
                  }),
                );
              } else {
                server.send(
                  JSON.stringify({
                    type: "FatalError",
                    error: "حساب اجازهٔ اتصال ندارد؛ دوباره وارد شوید.",
                  }),
                );
                close();
              }
            }
          })
          .catch(close);
      });
      let incoming = Promise.resolve();
      remote.addEventListener("message", (event) => {
        incoming = incoming
          .then(async () => {
            if (state.context)
              await assertAdmission(env.DB, env, state.context);
            server.send(event.data);
          })
          .catch(close);
      });
      server.addEventListener("close", close);
      server.addEventListener("error", close);
      remote.addEventListener("close", close);
      remote.addEventListener("error", close);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (
      request.method !== "POST" ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      fail("درخواست معتبر نیست.", 400);
    const raw = await request.text();
    if (raw.length > 1500000) fail("حجم درخواست زیاد است.", 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      fail("درخواست معتبر نیست.", 400);
    }
    if (body.componentPath || body.adminKey) fail("دسترسی مجاز نیست.");
    const header = request.headers.get("authorization"),
      token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const state = {
      context: token ? await authenticate(token, env, transport) : null,
    };
    await authorizeRpc(
      body.path,
      Array.isArray(body.args) ? body.args[0] : body.args,
      url.pathname.split("/").pop(),
      state,
      env,
      ip,
      transport,
    );
    const response = await transport(LEGACY + url.pathname, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: raw,
      signal: AbortSignal.timeout(55000),
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return error(e);
  }
}
