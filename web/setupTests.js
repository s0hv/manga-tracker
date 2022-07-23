/* eslint-disable import/no-extraneous-dependencies */
import '@testing-library/jest-dom/extend-expect';

import * as matchers from 'jest-extended';
import request from 'supertest';
import { csrfToken } from './__tests__/constants';

// Still produces warnings for some reason
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

expect.extend(matchers);
require('dotenv').config({ path: '../.env' });

// Don't want API calls to 3rd party services during tests
jest.mock('./db/mangadex', () => ({
  ...jest.requireActual('./db/mangadex'),
  fetchExtraInfo: jest.fn().mockImplementation(async () => {}),
}));

const Test = request.Test;

/**
 * Helper function to add csrf token to request
 * @memberOf supertest.Test
 * @return {supertest.Test}
 */
Test.prototype.csrf = function csrf() {
  return this.set('X-CSRF-Token', csrfToken);
};

/**
 * Helper function to check if response matches OpenAPI spec
 * @memberOf supertest.Test
 * @return {supertest.Test}
 */
Test.prototype.satisfiesApiSpec = function satisfiesApiSpec() {
  return this.expect(res => expect(res).toSatisfyApiSpec());
};
