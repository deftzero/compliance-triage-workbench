import { createYoga } from "graphql-yoga";
import { env } from "../../../config/env.js";
import { createRepositories } from "../repositories/index.js";
import { AuthService } from "../services/auth.service.js";
import { CaseService } from "../services/case.service.js";
import { seed } from "../services/seed.js";
import type { GraphQLContext } from "./builder.js";
import { maskError } from "./errors.js";
import { schema } from "./schema.js";

/** Versioned by URL, mirroring the src/api/v1 directory — a v2 is a new folder. */
export const GRAPHQL_PATH = "/api/v1/graphql";

export async function createYogaServer() {
  const repositories = createRepositories();

  const authService = new AuthService(repositories.users);
  const caseService = new CaseService(repositories.cases, repositories.audit);

  await seed(repositories, authService);

  return createYoga<Record<string, never>, GraphQLContext>({
    schema,
    graphqlEndpoint: GRAPHQL_PATH,
    // GraphiQL is the dev query IDE. Off in production — the schema shouldn't
    // be browsable there.
    graphiql: env.NODE_ENV !== "production" && { title: "Compliance API" },
    landingPage: false,
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
    maskedErrors: { maskError },
    context: async ({ request }): Promise<GraphQLContext> => {
      const header = request.headers.get("authorization");
      const token = header?.startsWith("Bearer ")
        ? header.slice("Bearer ".length).trim()
        : null;

      // An invalid token is treated as anonymous rather than fatal, so public
      // fields still resolve; anything requiring an actor then 401s on its own.
      const actor = token ? await authService.actorFromToken(token) : null;

      return { actor, services: { auth: authService, cases: caseService } };
    },
  });
}
