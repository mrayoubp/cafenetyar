import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { Endpoint, Api } from "./api";
export class BackendError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export const invalidation = "kfy-backend-updated";
export async function request<T = any>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const value = await response.json();
  if (!response.ok)
    throw new BackendError(
      value.error || "دریافت اطلاعات انجام نشد.",
      response.status,
    );
  return value;
}
export function useQuery<A, R>(
  endpoint: Endpoint<A, R>,
  args: A | "skip" = {} as A,
): R | undefined {
  const account = useContext(Auth).context?.user.id || "anonymous";
  const name = endpoint.name,
    key = JSON.stringify(args),
    [state, setState] = useState<{ key: string; data?: R; error?: Error }>({
      key: "",
    });
  const identity = account + name + key;
  useEffect(() => {
    if (args === "skip") return;
    let active = true,
      sequence = 0;
    const refresh = async () => {
      const current = ++sequence;
      try {
        const data = await request<R>("/api/rpc", {
          name,
          args: JSON.parse(key),
          kind: "query",
        });
        if (active && current === sequence) setState({ key: identity, data });
      } catch (error) {
        if (active && current === sequence)
          setState((old) => ({
            key: identity,
            data: old.key === identity ? old.data : undefined,
            error: error as Error,
          }));
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener(invalidation, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener(invalidation, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [name, key, account]);
  if (args === "skip" || state.key !== identity) return undefined;
  if (state.error && state.data === undefined) throw state.error;
  return state.data;
}
export function useMutation<A, R>(endpoint: Endpoint<A, R>) {
  return useCallback(
    async (args: A = {} as A) => {
      const value = await request<R>("/api/rpc", {
        name: endpoint.name,
        args,
        kind: "mutation",
      });
      window.dispatchEvent(new Event(invalidation));
      return value;
    },
    [endpoint.name],
  );
}
export const useAction = useMutation;
type Session =
  Api["tenancy"]["myContext"] extends Endpoint<any, infer R> ? R : never;
const Auth = createContext<{
  context: Session | undefined;
  error: string;
  refresh: () => Promise<void>;
}>({ context: undefined, error: "", refresh: async () => {} });
export function BackendProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<Session | undefined>(),
    [error, setError] = useState(""),
    sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const data = await request<Session>("/api/auth/context");
      if (current === sequence.current) {
        setContext(data);
        setError("");
      }
    } catch (err) {
      if (current === sequence.current) {
        setContext(null);
        setError((err as Error).message);
      }
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener(invalidation, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener(invalidation, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  return (
    <Auth.Provider value={{ context, error, refresh }}>
      {children}
    </Auth.Provider>
  );
}
export function useBackendAuth() {
  const { context, error, refresh } = useContext(Auth);
  return {
    context,
    isLoading: context === undefined,
    isAuthenticated: !!context,
    error,
    signIn: async (_provider: string, args: any) => {
      const identifier =
        args.identifier || String(args.email || "").split("@")[0];
      await request("/api/auth/login", { identifier, password: args.password });
      await refresh();
      window.dispatchEvent(new Event(invalidation));
    },
    signOut: async () => {
      await request("/api/auth/logout", {});
      await refresh();
      window.dispatchEvent(new Event(invalidation));
    },
  };
}
