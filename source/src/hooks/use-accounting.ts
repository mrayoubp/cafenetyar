import { useAuthToken } from "@convex-dev/auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountingData } from "@/lib/inventory";

export function useAccounting(enabled: boolean) {
  const token = useAuthToken();
  const [state, setState] = useState<{
    token: string | null;
    data?: AccountingData;
    error?: string;
  }>({ token: null });
  const identity = useRef(token);
  identity.current = token;
  const sequence = useRef(0);
  const api = useCallback(
    async (path = "", body?: unknown, signal?: AbortSignal) => {
      if (!token) throw new Error("ابتدا با حساب کافی‌نت وارد شوید.");
      const response = await fetch("/api/accounting" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: "Bearer " + token,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
        cache: "no-store",
      });
      const type = response.headers.get("content-type") || "";
      if (!type.includes("application/json"))
        throw new Error("ارتباط با حسابداری برقرار نشد؛ صفحه را به‌روز کنید.");
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error || "ذخیرهٔ اطلاعات انجام نشد.");
      return value;
    },
    [token],
  );
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled || !token) return;
      const current = ++sequence.current;
      try {
        const data = await api("", undefined, signal);
        if (identity.current === token && current === sequence.current)
          setState({ token, data });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (identity.current === token && current === sequence.current)
          setState((previous) => ({
            token,
            data: previous.token === token ? previous.data : undefined,
            error: (error as Error).message || "دریافت اطلاعات انجام نشد.",
          }));
      }
    },
    [api, enabled, token],
  );
  useEffect(() => {
    if (!enabled || !token) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    const update = () => void refresh(controller.signal);
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [enabled, token, refresh]);
  const mutate = useCallback(
    async (path: string, body: unknown) => {
      const result = await api(path, body);
      await refresh();
      return result;
    },
    [api, refresh],
  );
  return {
    data: state.token === token ? state.data : undefined,
    error: state.token === token ? state.error : undefined,
    refresh: () => refresh(),
    mutate,
  };
}
