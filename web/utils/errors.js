const HttpError = (statusCode, message) => {
  if (!message && statusCode === 404) {
    message = 'Not found';
  }
  message = message || 'Internal server error';
  const err = new Error(message);
  err.status = statusCode;
  return err;
};
module.exports.HttpError = HttpError;

const RenderError = (statusCode) => {
  throw HttpError(statusCode);
};
module.exports.RenderError = RenderError;

/**
 * Base class for errors that define a HTTP status code.
 * Does not inherit the Error class as express-validators library
 * only gives the error message if the error is an instance of Error.
 * This allows us to pass the whole error as the error parameter.
 */
class StatusError {
  constructor(message, name, status) {
    this.message = message;
    this.name = name;
    this.status = status;
  }
}
module.exports.StatusError = StatusError;

class Forbidden extends StatusError {
  constructor(message) {
    super(message, 'Forbidden', 403);
  }
}
module.exports.Forbidden = Forbidden;

class Unauthorized extends StatusError {
  constructor(message) {
    super(message, 'Unauthorized', 401);
  }
}
module.exports.Unauthorized = Unauthorized;

class NotFound extends StatusError {
  constructor(message) {
    super(message, 'Not Found', 404);
  }
}
module.exports.NotFound = NotFound;

class BadRequest extends StatusError {
  constructor(message) {
    super(message, 'Bad Request', 400);
  }
}
module.exports.BadRequest = BadRequest;
