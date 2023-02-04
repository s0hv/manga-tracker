import matchers from '@testing-library/jest-dom/matchers';
import { vi } from 'vitest';
import { config } from 'dotenv';

import * as extendedMatchers from 'jest-extended';

import request from 'supertest';
import { csrfToken } from './__tests__/constants';


expect.extend(matchers);
expect.extend(extendedMatchers);

config({ path: '../.env' });

// Don't want API calls to 3rd party services during tests
vi.mock('./db/mangadex', () => ({
  MANGADEX_ID: 2,
  fetchExtraInfo: vi.fn().mockImplementation(async () => {}),
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
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
  return this.expect((res: any) => expect(res).toSatisfyApiSpec());
};

// Cannot mock csrf using vitest because it does not support require mocks
// Just manually replace the prototype instead

// eslint-disable-next-line @typescript-eslint/no-var-requires,import/no-extraneous-dependencies
const Token = require('csrf');

Token.prototype.create = () => csrfToken;
Token.prototype.verify = (secret: any, token: any) => token === csrfToken;
Token.prototype.secretSync = () => 'secret';

vi.mock('next');
vi.mock('next/router');
vi.mock('@next/font/google', () => {
  return {
    Roboto: vi.fn(),
  };
});
vi.mock('date-fns');
