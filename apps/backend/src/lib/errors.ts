/**
 * Errors that are safe to surface to a client. Anything thrown that is *not*
 * an HttpError is treated as an unexpected bug by the error handler and
 * reported as a generic 500 / INTERNAL_ERROR.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad request") {
    super(400, "BAD_REQUEST", message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
  }
}

/** Authenticated, but not allowed — distinct from 401 so the UI can tell them apart. */
export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict") {
    super(409, "CONFLICT", message);
  }
}

/**
 * A close attempt on a case that isn't ready. Carries the *full* blocker list
 * rather than a generic message, so the caller learns everything outstanding
 * in one round trip (§5 contract) — never a silent no-op.
 */
export class ClosureBlockedError extends HttpError {
  constructor(readonly blockers: string[]) {
    super(422, "CLOSURE_BLOCKED", "Case is not ready to be closed");
    this.name = "ClosureBlockedError";
  }
}
