import app from '../native/composed-server.mjs';
import { accessConfigured, authenticatedRequest } from './access.mjs';

export default { async fetch(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === '/signin-with-chatgpt') return Response.redirect(new URL('/manage', url), 302);
  if (url.pathname === '/signout-with-chatgpt') return Response.redirect(new URL('/cdn-cgi/access/logout', url), 302);
  if (url.pathname === '/manage' || url.pathname.startsWith('/manage/')) {
    if (!accessConfigured(env)) return new Response('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>راه‌اندازی مدیریت</title><body style="font:16px Tahoma;line-height:2;max-width:650px;margin:60px auto;padding:20px"><h1>ورود مدیریت هنوز راه‌اندازی نشده است</h1><p>مالک باید Cloudflare Access و تنظیمات CF_ACCESS_TEAM_DOMAIN و CF_ACCESS_AUD را فعال کند.</p><p><a href="https://github.com/mrayoubp/cafenetyar/blob/main/cloudflare/README.md">راهنمای راه‌اندازی</a> · <a href="/">صفحهٔ اصلی</a></p></body></html>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  const trusted = await authenticatedRequest(request, env);
  const response = await app.fetch(trusted, env, ctx);
  if (url.pathname === '/manage' || url.pathname.startsWith('/manage/')) {
    return new Response((await response.text()).replaceAll('ChatGPT', 'Cloudflare Access'), { status: response.status, headers: response.headers });
  }
  return response;
} };
