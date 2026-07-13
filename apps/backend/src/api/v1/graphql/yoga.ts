import { createYoga } from "graphql-yoga";
import { env } from "../../../config/env";
import { createRepositories } from "../repositories/index";
import { AuthService } from "../services/auth.service";
import { CaseService } from "../services/case.service";
import { seed } from "../services/seed";
import type { GraphQLContext } from "./builder";
import { maskError } from "./errors";
import { schema } from "./schema";

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
