import { useAuthToken } from "@convex-dev/auth/react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
const Admission = createContext({ allowed: false, loading: true, error: "" });
export function SiteAdmissionProvider({ children }: { children: ReactNode }) {
  const token = useAuthToken(),
    latest = useRef(token);
  latest.current = token;
  const [state, setState] = useState<{
    token: string | null;
    allowed: boolean;
    error: string;
  }>({ token: null, allowed: false, error: "" });
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    let sequence = 0;
    const check = async () => {
      const current = ++sequence;
      try {
        const response = await fetch("/api/site-access", {
          headers: { Authorization: "Bearer " + token },
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
        });
        const data = await response.json();
        if (latest.current === token && current === sequence)
          setState({
            token,
            allowed: response.ok && data.ok === true,
            error: response.ok ? "" : data.error || "حساب اجازهٔ ورود ندارد.",
          });
      } catch (error) {
        if (
          !controller.signal.aborted &&
          latest.current === token &&
          current === sequence
        )
          setState({
            token,
            allowed: false,
            error:
              "بررسی اجازهٔ ورود انجام نشد؛ اتصال را بررسی و دوباره تلاش کن.",
          });
      }
    };
    void check();
    const timer = window.setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [token]);
  const current = !!token && state.token === token;
  return (
    <Admission.Provider
      value={{
        allowed: current && state.allowed,
        loading: !!token && !current,
        error: current ? state.error : "",
      }}
    >
      {children}
    </Admission.Provider>
  );
}
export const useSiteAdmission = () => useContext(Admission);
