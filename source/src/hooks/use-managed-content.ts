import { useCallback, useEffect, useState } from 'react';
import { getFunctionName } from 'convex/server';
import { useQuery as convexQuery, useMutation as convexMutation } from 'convex/react';
const enabled = import.meta.env.VITE_SITE_ADMIN === 'true';
const invalidation = 'kfy-content-updated';
async function result(response: Response) {
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'دریافت اطلاعات مدیریت سایت ممکن نشد.');
  return value;
}
export const useQuery: typeof convexQuery = ((reference: any, args: any = {}) => {
  if (!enabled) return convexQuery(reference, args);
  const name = getFunctionName(reference), key = JSON.stringify(args);
  const [value, setValue] = useState<any>(undefined);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (args === 'skip') return;
    let active = true;
    const controller = new AbortController();
    const refresh = () => fetch('/api/bridge?' + new URLSearchParams({ name, args: key }), { signal: controller.signal })
      .then(result).then(data => { if (active) { setValue(data); setError(null); } })
      .catch(caught => { if (active && caught.name !== 'AbortError') setError(caught); });
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener(invalidation, refresh);
    window.addEventListener('focus', refresh);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener(invalidation, refresh); window.removeEventListener('focus', refresh); };
  }, [name, key]);
  if (error) throw error;
  return value;
}) as typeof convexQuery;
export const useMutation: typeof convexMutation = ((reference: any) => {
  if (!enabled) return convexMutation(reference);
  const name = getFunctionName(reference);
  return useCallback(async (args: any) => {
    const value = await fetch('/api/bridge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, args }) }).then(result);
    window.dispatchEvent(new Event(invalidation));
    return value;
  }, [name]);
}) as typeof convexMutation;
export type ManagedSettings = { title?: string; tagline?: string; logo?: string; contact?: string; heroTitle?: string; heroSubtitle?: string };
export function useManagedSettings() {
  const [settings, setSettings] = useState<ManagedSettings>({});
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const refresh = () => fetch('/api/branding').then(result).then(value => { if (active) setSettings(value); }).catch(() => {});
    void refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return settings;
}
