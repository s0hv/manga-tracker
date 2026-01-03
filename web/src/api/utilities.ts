import { notFound } from '@tanstack/react-router';
import ky from 'ky';

export const baseKy = ky.extend({
  prefixUrl: '/api',
});

export class APIException extends Error {
  public readonly statusCode: number;

  constructor(msg: string, statusCode = 400) {
    super(msg);

    this.statusCode = statusCode;
  }
}

export class HTTPException extends Error {
  private response: Response;
  /**
   * @param {string} msg
   * @param {Response} res
   */
  constructor(msg: string, res: Response) {
    super(msg);
    this.response = res;
  }

  get statusCode(): number {
    return this.response.status;
  }
}

/**
 * Gets the data from a response and throws an error if the error key is present
 * @param json json response
 * @param status status code of the response
 * @throws {APIException} Thrown when errors found
 */
export const getResponseData = async <T = any>(json: any, status: number): Promise<T> => {
  let error = json.error;
  if (!error) {
    return json.data ?? json;
  }

  if (error instanceof String) {
    throw new APIException(error as string, status);
  }

  if (error instanceof Array) {
    error = error[0];
  }

  throw new APIException(error.msg || error, status);
};

type HandleResponse = {
  <T = any>(res: Response): Promise<T>
  (res: Response): Promise<void>
};

/**
 * Handles checking if request was successful and if it was returns the json body
 * @param {Response} res
 * @returns {Promise<any>} json body of the request
 * @throws {APIException} exception thrown if non-ok status code
 */
export const handleResponse: HandleResponse = async <T = any>(res: Response): Promise<T | void> => {
  const contentType = res.headers.get('content-type') || '';
  const isJson = /application\/json/i.test(contentType);

  if (!res.ok && !isJson) {
    throw new HTTPException(`Server returned status ${res.status} ${res.statusText}`, res);
  }

  if (res.ok && !isJson) {
    return;
  }

  return res.json()
    .then(data => getResponseData<T>(data, res.status));
};

export const handleError = async (err: any): Promise<never> => {
  if (!(err instanceof APIException) && !(err instanceof HTTPException)) {
    console.error('Unhandled error', err);
    throw new Error('Unexpected error occurred');
  }
  throw err;
};

export function handleErrorInRoute(err: unknown): never {
  if (err instanceof APIException && err.statusCode === 404) {
    throw notFound();
  }

  throw err;
}
