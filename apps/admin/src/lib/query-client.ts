import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The dashboard's simulated failures are meant to be *seen*, so don't
      // silently retry them away. Raise this for real endpoints.
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
