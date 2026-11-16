import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

/**
 * Reactive tenant/session context. Returns `undefined` while loading,
 * `null` when signed out and the full context otherwise.
 */
export function useSession() {
  const context = useQuery(api.tenancy.myContext);
  return {
    context,
    isLoading: context === undefined,
  };
}

export type SessionContext = NonNullable<
  ReturnType<typeof useSession>["context"]
>;
