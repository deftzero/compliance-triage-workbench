import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createApp } from "../../app.js";
import { GRAPHQL_PATH } from "../../api/v1/graphql/yoga.js";
import { SEED_PASSWORD } from "../../api/v1/services/seed.js";

/** A GraphQL response as it arrives on the wire — errors included, not thrown. */
export type GraphQLResponse<T = Record<string, unknown>> = {
  data?: T | null;
  errors?: {
    message: string;
    extensions?: {
      code?: string;
      status?: number;
      blockers?: string[];
      issues?: { path: string; message: string }[];
    };
  }[];
};

export type TestServer = {
  gql: <T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
    token?: string,
  ) => Promise<GraphQLResponse<T>>;
  login: (email: string) => Promise<string>;
  close: () => Promise<void>;
};

/**
 * Boots the real Express + Yoga app on an ephemeral port and talks to it over
 * HTTP, so a test exercises the same stack a client does: body parsing, the
 * Yoga context that turns a bearer token into an actor, and `maskError` — none
 * of which a test calling CaseService directly would touch.
 *
 * Each call gets its own repositories and its own seed (`createApp` builds both),
 * so servers started by different suites cannot see each other's data.
 */
export async function startTestServer(): Promise<TestServer> {
  const app = await createApp();
  const server = app.listen(0);
  await once(server, "listening");

  const { port } = server.address() as AddressInfo;
  const endpoint = `http://127.0.0.1:${port}${GRAPHQL_PATH}`;

  async function gql<T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
    token?: string,
  ): Promise<GraphQLResponse<T>> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });

    return (await response.json()) as GraphQLResponse<T>;
  }

  async function login(email: string): Promise<string> {
    const result = await gql<{ login: { token: string } }>(
      `mutation ($email: String!, $password: String!) {
        login(email: $email, password: $password) { token }
      }`,
      { email, password: SEED_PASSWORD },
    );

    const token = result.data?.login.token;
    if (!token) {
      throw new Error(`Could not log in as ${email}: ${JSON.stringify(result)}`);
    }
    return token;
  }

  async function close(): Promise<void> {
    server.close();
    await once(server, "close");
  }

  return { gql, login, close };
}

/** The single error a failed operation returned. Fails loudly if it succeeded. */
export function errorOf(response: GraphQLResponse): {
  message: string;
  code: string;
  blockers: string[];
  issues: { path: string; message: string }[];
} {
  const first = response.errors?.[0];
  if (!first) {
    throw new Error(
      `Expected the operation to fail, but it returned: ${JSON.stringify(response.data)}`,
    );
  }

  return {
    message: first.message,
    code: first.extensions?.code ?? "UNKNOWN",
    blockers: first.extensions?.blockers ?? [],
    issues: first.extensions?.issues ?? [],
  };
}

/** The data a successful operation returned. Fails loudly if it errored. */
export function dataOf<T>(response: GraphQLResponse<T>): T {
  if (response.errors || !response.data) {
    throw new Error(
      `Expected the operation to succeed, but it failed: ${JSON.stringify(response.errors)}`,
    );
  }
  return response.data;
}
