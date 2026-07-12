/**
 * Errors that are safe to surface to a client. Anything thrown that is *not*
 * an HttpError is treated as an unexpected bug by the error middleware and
 * reported as a generic 500.
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
