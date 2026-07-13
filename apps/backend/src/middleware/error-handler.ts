import type { ApiError } from "@repo/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { env } from "../config/env";
import { HttpError } from "../lib/errors";

/**
 * These only cover the REST surface that survives (/health) and unknown paths.
 * Everything under /api/v1/graphql is handled by Yoga's own error masking.
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiError = {
    error: {
      code: "NOT_FOUND",
      message: `Cannot ${req.method} ${req.path}`,
    },
  };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    } satisfies ApiError);
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "Internal server error"
          : err instanceof Error
            ? err.message
            : String(err),
    },
  } satisfies ApiError);
};
