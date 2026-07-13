import SchemaBuilder from "@pothos/core";
import type { Actor } from "@repo/shared";
import { UnauthorizedError } from "../../../lib/errors";
import type { AuthService } from "../services/auth.service";
import type { CaseService } from "../services/case.service";

export type GraphQLContext = {
  /** Null for unauthenticated requests; resolvers opt in via `requireActor`. */
  actor: Actor | null;
  services: {
    auth: AuthService;
    cases: CaseService;
  };
};

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  // ISO-8601 strings on the wire. A custom DateTime scalar would buy little
  // here — the shared Zod schemas already validate the format.
  DefaultFieldNullability: false;
}>({
  defaultFieldNullability: false,
});

builder.queryType({});
builder.mutationType({});

/**
 * The single place a resolver turns an anonymous request away. Authorization
 * beyond "is logged in" belongs to the domain layer, not here.
 */
export function requireActor(context: GraphQLContext): Actor {
  if (!context.actor) {
    throw new UnauthorizedError("You must be signed in.");
  }
  return context.actor;
}
