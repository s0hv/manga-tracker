export class APIException extends Error {}

export class HTTPException extends Error {
  /**
   * @param {string} msg
   * @param {Response} res
   */
  constructor(msg, res) {
    super(msg);
    this.response = res;
  }
}

/**
 * Gets the data from a response and throws an error if the error key is present
 * @param {object} json json response
 * @return {Promise<any>}
 * @throws {APIException} Thrown when errors found
 */
export const getResponseData = async (json) => {
  let error = json.error;
  if (!error) {
    return json.data || json;
  }

  if (error instanceof String) {
    throw new APIException(error);
  }

  if (error instanceof Array) {
    error = error[0];
  }

  throw new APIException(error.msg || error);
};

/**
 * Handles checking if request was successful and if it was returns the json body
 * @param {Response} res
 * @returns {Promise<any>} json body of the request
 * @throws {APIException} exception thrown if non-ok status code
 *
 */
export const handleResponse = async (res) => {
  const contentType = res.headers.get('content-type');
  const isJson = /application\/json/i.test(contentType);

  if (!res.ok && !isJson) {
    throw new HTTPException(`Server returned status ${res.statusCode} ${res.statusText}`, res);
  }

  if (res.ok && !isJson) {
    return;
  }

  return res.json()
    .then(getResponseData);
};

export const handleError = async (err) => {
  if (!(err instanceof APIException) && !(err instanceof HTTPException)) {
    console.error('Unhandled error', err);
    throw new Error('Unexpected error occurred');
  }
  throw err;
};
