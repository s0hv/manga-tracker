import { notFound } from '@tanstack/react-router';
import ky from 'ky';

export const baseKy = ky.extend({
  prefix: '/api',
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
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const getResponseData = <T = any>(json: any, status: number): T => {
  // Temporarily disabled until this utility is refactored
  /* eslint-disable @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
  let error = json.error;
  if (!error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return json.data ?? json;
  }

  if (error instanceof String) {
    throw new APIException(error as string, status);
  }

  if (error instanceof Array) {
    error = error[0];
  }

  throw new APIException(error.msg || error, status);
  /* eslint-enable @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
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
export const handleResponse: HandleResponse = async <T = any>(res: Response): Promise<T | undefined> => {
  const contentType = res.headers.get('content-type') ?? '';
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

export const handleError = (err: any): never => {
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
