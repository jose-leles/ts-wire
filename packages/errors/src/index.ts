export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequest extends HttpError {
  constructor(message = 'Bad Request') { super(400, message); }
}

export class Unauthorized extends HttpError {
  constructor(message = 'Unauthorized') { super(401, message); }
}

export class Forbidden extends HttpError {
  constructor(message = 'Forbidden') { super(403, message); }
}

export class NotFound extends HttpError {
  constructor(message = 'Not Found') { super(404, message); }
}

export class Conflict extends HttpError {
  constructor(message = 'Conflict') { super(409, message); }
}

export class UnprocessableEntity extends HttpError {
  constructor(message = 'Unprocessable Entity') { super(422, message); }
}

export class TooManyRequests extends HttpError {
  constructor(message = 'Too Many Requests') { super(429, message); }
}

export class InternalError extends HttpError {
  constructor(message = 'Internal Server Error') { super(500, message); }
}
