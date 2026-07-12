import type { RequestHandler } from "express";
import type { ZodType } from "zod";

/**
 * Validates and *replaces* req.body with the parsed result, so controllers
 * downstream get the coerced, defaulted, fully-typed value rather than the
 * raw JSON. Zod failures are thrown and shaped by the error middleware.
 */
export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.parse(req.body);
    req.body = parsed;
    next();
  };
}
