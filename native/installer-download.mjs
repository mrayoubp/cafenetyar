const noStore = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const digest = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
export async function installerDownload(request, env, payload) {
  if (!["GET", "HEAD"].includes(request.method))
    return new Response(null, {
      status: 405,
      headers: { ...noStore, Allow: "GET, HEAD" },
    });
  const key = new URL(request.url).searchParams.get("key");
  if (!key || key.length > 100 || !env.LINUX_DOWNLOAD_HASH)
    return new Response("Not found", { status: 404, headers: noStore });
  const actual = await digest(key),
    expected = env.LINUX_DOWNLOAD_HASH;
  let mismatch = actual.length ^ expected.length;
  for (let i = 0; i < actual.length; i++)
    mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  if (mismatch)
    return new Response("Not found", { status: 404, headers: noStore });
  if (
    !Number.isFinite(Number(env.LINUX_DOWNLOAD_EXPIRES_AT)) ||
    Date.now() > Number(env.LINUX_DOWNLOAD_EXPIRES_AT)
  )
    return new Response("این لینک دانلود منقضی شده است.", {
      status: 410,
      headers: noStore,
    });
  const size =
    (payload.base64.length / 4) * 3 -
    (payload.base64.endsWith("==") ? 2 : payload.base64.endsWith("=") ? 1 : 0);
  let first = 0,
    last = size - 1,
    status = 200;
  const headers = {
    ...noStore,
    "Content-Type": "application/zip",
    "Content-Disposition": 'attachment; filename="cafenetyar-linux-4.0.0.zip"',
    "Accept-Ranges": "bytes",
    "X-Checksum-Sha256": payload.sha256,
  };
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: { ...noStore, "Content-Range": "bytes */" + size },
      });
    if (match[1]) {
      first = Number(match[1]);
      last = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    } else {
      const suffix = Number(match[2]);
      if (!suffix)
        return new Response(null, {
          status: 416,
          headers: { ...noStore, "Content-Range": "bytes */" + size },
        });
      first = Math.max(0, size - suffix);
    }
    if (
      !Number.isSafeInteger(first) ||
      !Number.isSafeInteger(last) ||
      first > last ||
      first >= size
    )
      return new Response(null, {
        status: 416,
        headers: { ...noStore, "Content-Range": "bytes */" + size },
      });
    status = 206;
    headers["Content-Range"] = "bytes " + first + "-" + last + "/" + size;
  }
  headers["Content-Length"] = String(last - first + 1);
  if (request.method === "HEAD") return new Response(null, { status, headers });
  const binary = atob(payload.base64),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes.subarray(first, last + 1), { status, headers });
}

export async function installerPage(request, env, payload) {
  if (!["GET", "HEAD"].includes(request.method))
    return new Response(null, {
      status: 405,
      headers: { ...noStore, Allow: "GET, HEAD" },
    });
  const allowed = await installerDownload(
    new Request(request.url, { method: "HEAD" }),
    env,
    payload,
  );
  if (allowed.status !== 200) return allowed;
  const key = new URL(request.url).searchParams.get("key"),
    href =
      "/downloads/cafenetyar-linux-4.0.0.zip?key=" + encodeURIComponent(key),
    size = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(
      Number(allowed.headers.get("content-length")) / 1024 / 1024,
    );
  const html = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>دانلود کافی‌نت‌یار برای لینوکس</title><style>body{margin:0;background:#eef5f6;color:#15343e;font:16px Tahoma,Arial,sans-serif;line-height:2}main{max-width:580px;margin:10vh auto;padding:32px;background:white;border:1px solid #d2e1e4;border-radius:24px}h1{font-size:24px;line-height:1.6}p{color:#4b626b}.download{display:block;text-align:center;padding:15px 20px;background:#087e8b;border-radius:12px;color:white;text-decoration:none;font-weight:bold;margin:26px 0}small{font-size:14px}code{direction:ltr;display:inline-block;font-size:14px;overflow-wrap:anywhere}@media(max-width:650px){main{margin:30px 16px;padding:24px}}</style><main><h1>نسخهٔ آمادهٔ نصب کافی‌نت‌یار</h1><p>فایل اصلی ZIP برای هاست دارای Node.js 24، همراه با سرور، رابط سایت، دیتابیس SQLite و راهنمای نصب فارسی.</p><a class="download" href="${href}" download="cafenetyar-linux-4.0.0.zip" target="_blank" rel="noopener noreferrer">دانلود فایل نصب — ${size} مگابایت</a><p>نام فایل: <code>cafenetyar-linux-4.0.0.zip</code></p><small>بعد از دریافت، فایل را از حالت فشرده خارج کن و راهنمای <code>README-fa.md</code> را بخوان. اگر داخل برنامه دانلود شروع نشد، لینک این صفحه را در Chrome یا Firefox باز کن و دکمه را بزن.</small></main></html>`;
  return new Response(request.method === "HEAD" ? null : html, {
    headers: {
      ...noStore,
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
