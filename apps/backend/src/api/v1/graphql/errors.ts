import { GraphQLError } from "graphql";
import { ZodError } from "zod";
import { env } from "../../../config/env";
import { ClosureBlockedError, HttpError } from "../../../lib/errors";

/**
 * Turns domain failures into GraphQL errors with a machine-readable `code`,
 * and lets everything else surface as a generic INTERNAL_ERROR so a stack
 * trace never reaches a client.
 *
 * A blocked close carries its full blocker list in `extensions.blockers` —
 * the client is told exactly what's outstanding rather than "close failed".
 */
export function maskError(error: unknown): GraphQLError {
  if (error instanceof GraphQLError && error.originalError === undefined) {
    // Already a GraphQL-level error (bad query, unknown field) — pass through.
    return error;
  }

  const original =
    error instanceof GraphQLError ? (error.originalError ?? error) : error;

  if (original instanceof ZodError) {
    return new GraphQLError("Input validation failed", {
      extensions: {
        code: "VALIDATION_ERROR",
        issues: original.issues.map((issue) => ({
          path: issue.path.join(".") || "(root)",
          message: issue.message,
        })),
      },
    });
  }

  if (original instanceof ClosureBlockedError) {
    return new GraphQLError(original.message, {
      extensions: {
        code: original.code,
        status: original.status,
        blockers: original.blockers,
      },
    });
  }

  if (original instanceof HttpError) {
    return new GraphQLError(original.message, {
      extensions: { code: original.code, status: original.status },
    });
  }

  console.error("Unhandled GraphQL error:", original);
  return new GraphQLError(
    env.NODE_ENV === "production"
      ? "Internal server error"
      : original instanceof Error
        ? original.message
        : String(original),
    { extensions: { code: "INTERNAL_ERROR", status: 500 } },
  );
}
