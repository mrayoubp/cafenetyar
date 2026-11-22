import { useBackendAuth } from "@/backend/client";
export function useSession() {
  const { context, isLoading } = useBackendAuth();
  return { context, isLoading };
}
export type SessionContext = NonNullable<
  ReturnType<typeof useSession>["context"]
>;
