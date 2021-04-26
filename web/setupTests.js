/* eslint-disable import/no-extraneous-dependencies */
import '@testing-library/jest-dom/extend-expect';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';

import { configure } from 'enzyme';
import 'jest-extended';
import request from 'supertest';
import { csrfToken } from './__tests__/constants';

configure({ adapter: new Adapter() });

require('dotenv').config({ path: '../.env' });

// Don't want API calls to 3rd party services during tests
jest.mock('./db/mangadex', () => ({
  ...jest.requireActual('./db/manga'),
  fetchExtraInfo: jest.fn().mockImplementation(async () => {}),
}));

const Test = request.Test;

// Helper function to add csrf token to request
Test.prototype.csrf = function csrf() {
  return this.set('X-CSRF-Token', csrfToken);
};

// Helper function to check if response matches OpenAPI spec
Test.prototype.satisfiesApiSpec = function satisfiesApiSpec() {
  return this.expect(res => expect(res).toSatisfyApiSpec());
};
