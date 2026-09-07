export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly fields?: Record<string, string>

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', fields?: Record<string, string>) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.fields = fields
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The submitted data is invalid.', fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR', fields)
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 401, 'AUTHENTICATION_REQUIRED')
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'PERMISSION_DENIED')
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(message = 'A resource with these details already exists.') {
    super(message, 409, 'CONFLICT')
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED')
  }
}
