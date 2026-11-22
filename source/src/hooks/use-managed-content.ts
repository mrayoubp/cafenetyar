import {useState,useEffect} from "react";
export {useQuery,useMutation} from "@/backend/client";
const enabled=true;
async function result(response:Response){if(!response.ok)throw new Error("دریافت اطلاعات ممکن نشد.");return response.json();}
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
