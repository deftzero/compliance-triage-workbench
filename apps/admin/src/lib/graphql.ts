import { ClientError, GraphQLClient } from "graphql-request";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export const GRAPHQL_ENDPOINT = `${apiUrl}/api/v1/graphql`;

const TOKEN_KEY = "compliance.token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const gqlClient = new GraphQLClient(GRAPHQL_ENDPOINT, {
  // Read the token per request rather than at construction, so signing in
  // doesn't require rebuilding the client.
  requestMiddleware: (request) => {
    const token = tokenStore.get();

    // Build on top of the existing headers via Headers rather than spreading
    // them: `request.headers` can be a Headers instance, and spreading one
    // yields {} — which silently drops content-type and gets every request
    // rejected with 415.
    const headers = new Headers(request.headers as HeadersInit);
    if (token) headers.set("authorization", `Bearer ${token}`);

    return { ...request, headers };
  },
});

/**
 * A failed request, flattened into something the UI can render directly.
 * `blockers` is populated only for CLOSURE_BLOCKED — the backend returns the
 * complete list of what's outstanding, and we surface it verbatim rather than
 * recomputing or summarizing it.
 */
export class ApiError extends Error {
  // Declared as fields rather than constructor parameter properties: the app's
  // tsconfig sets erasableSyntaxOnly, so only type-strippable syntax is allowed.
  readonly code: string;
  readonly blockers: string[];
  readonly issues: { path: string; message: string }[];

  constructor(
    message: string,
    code: string,
    blockers: string[] = [],
    issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.blockers = blockers;
    this.issues = issues;
  }
}

type ErrorExtensions = {
  code?: string;
  blockers?: string[];
  issues?: { path: string; message: string }[];
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ClientError) {
    const first = error.response.errors?.[0];
    const extensions = (first?.extensions ?? {}) as ErrorExtensions;

    return new ApiError(
      first?.message ?? "Request failed",
      extensions.code ?? "UNKNOWN",
      extensions.blockers ?? [],
      extensions.issues ?? [],
    );
  }

  return new ApiError(
    error instanceof Error ? error.message : String(error),
    "NETWORK_ERROR",
  );
}

/** Every call goes through here, so no caller has to unwrap ClientError itself. */
export async function request<T>(
  document: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  try {
    return await gqlClient.request<T>(document, variables);
  } catch (error) {
    throw toApiError(error);
  }
}
