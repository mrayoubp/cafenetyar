import { useSiteAdmission } from "./use-site-admission";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const admission = useSiteAdmission();
  const user = useQuery(api.users.currentUser, admission.allowed ? {} : "skip");
  const { signIn, signOut } = useAuthActions();

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = admission.error
    ? false
    : isAuthLoading ||
      admission.loading ||
      (isAuthenticated && admission.allowed && user === undefined);

  return {
    isLoading,
    isAuthenticated: isAuthenticated && admission.allowed,
    accessError: admission.error,
    user,
    signIn,
    signOut,
  };
}
