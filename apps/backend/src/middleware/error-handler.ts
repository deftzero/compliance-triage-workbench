import type { ApiError } from "@repo/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiError = {
    error: {
      code: "NOT_FOUND",
      message: `Cannot ${req.method} ${req.path}`,
    },
  };
  res.status(404).json(body);
};

/**
 * The single place an error becomes a response. Every failure leaves the API
 * in the shared `ApiError` shape, so the admin app has exactly one thing to parse.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const body: ApiError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        issues: err.issues.map((issue) => ({
          path: issue.path.join(".") || "(root)",
          message: issue.message,
        })),
      },
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof HttpError) {
    const body: ApiError = {
      error: { code: err.code, message: err.message },
    };
    res.status(err.status).json(body);
    return;
  }

  // Anything else is a bug: log it in full, tell the client nothing.
  console.error("Unhandled error:", err);
  const body: ApiError = {
    error: {
      code: "INTERNAL_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "Internal server error"
          : err instanceof Error
            ? err.message
            : String(err),
    },
  };
  res.status(500).json(body);
};
