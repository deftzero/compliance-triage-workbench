import type { PublicUser, Role } from "@repo/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, type ReactNode } from "react";
import { fetchMe, login as loginRequest } from "./api";
import { tokenStore } from "./graphql";

type AuthState = {
  user: PublicUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // The token alone isn't trusted: we ask the server who it belongs to, so an
  // expired or tampered token resolves to a signed-out state.
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: tokenStore.get() !== null,
    retry: false,
  });

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await loginRequest(email, password);
      tokenStore.set(result.token);
      queryClient.setQueryData(["me"], result.user);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const signOut = useCallback(() => {
    tokenStore.clear();
    queryClient.setQueryData(["me"], null);
    queryClient.removeQueries({
      predicate: (q) => q.queryKey[0] !== "me",
    });
  }, [queryClient]);

  return (
    <AuthContext
      value={{
        user: data ?? null,
        isLoading: isLoading && tokenStore.get() !== null,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthState {
  const context = use(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

/**
 * Role checks for *display* only. The backend enforces the same rules
 * independently — hiding a button is a courtesy, not a control.
 */
export const can = {
  triage: (role: Role) => role === "ComplianceManager",
  editWorkflow: (role: Role) => role === "ComplianceManager",
  close: (role: Role) => role === "ComplianceManager",
  reportCase: (role: Role) => role !== "Auditor",
};
