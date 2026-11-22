import { useBackendAuth } from "@/backend/client";
export function useAuth() {
  const auth = useBackendAuth();
  return {
    ...auth,
    accessError: auth.error,
    user: auth.context
      ? { ...auth.context.user, _id: auth.context.user.id, image: null }
      : null,
  };
}
