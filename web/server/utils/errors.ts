export const HttpError = (statusCode: number, message?: string) => {
  if (!message && statusCode === 404) {
    message = 'Not found';
  }
  message = message || 'Internal server error';
  const err = new Error(message);
  (err as StatusError).status = statusCode;
  return err;
};


/**
 * Base class for errors that define an HTTP status code.
 * Does not inherit the Error class as the express-validators library
 * only gives the error message if the error is an instance of Error.
 * This allows us to pass the whole error as the error parameter.
 */
export class StatusError {
  public message: string;
  public name: string;
  public status: number;

  constructor(message: string, name: string, status: number) {
    this.message = message;
    this.name = name;
    this.status = status;
  }
}

export class Forbidden extends StatusError {
  constructor(message: string) {
    super(message, 'Forbidden', 403);
  }
}

export class Unauthorized extends StatusError {
  constructor(message: string) {
    super(message, 'Unauthorized', 401);
  }
}

export class NotFound extends StatusError {
  constructor(message: string) {
    super(message, 'Not Found', 404);
  }
}

export class BadRequest extends StatusError {
  constructor(message: string) {
    super(message, 'Bad Request', 400);
  }
}
