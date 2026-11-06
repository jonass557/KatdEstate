export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class HttpError extends AppError {
  constructor(statusCode: number, message: string, details?: unknown) {
    const code =
      statusCode === 400
        ? 'BAD_REQUEST'
        : statusCode === 401
          ? 'UNAUTHENTICATED'
          : statusCode === 403
            ? 'FORBIDDEN'
            : statusCode === 404
              ? 'NOT_FOUND'
              : statusCode === 409
                ? 'CONFLICT'
                : statusCode === 422
                  ? 'VALIDATION_ERROR'
                  : 'INTERNAL_ERROR';
    super(code, message, statusCode, details);
    this.name = 'HttpError';
  }
}
