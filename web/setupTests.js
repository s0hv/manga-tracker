/* eslint-disable import/no-extraneous-dependencies */
import '@testing-library/jest-dom/extend-expect';
import 'jest-extended';

import { configure } from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import request from 'supertest';
import { csrfToken } from './__tests__/constants';

configure({ adapter: new Adapter() });

require('dotenv').config({ path: '../.env' });

jest.mock('./db/mangadex', () => ({
  ...jest.requireActual('./db/manga'),
  fetchExtraInfo: jest.fn().mockImplementation(async () => {}),
}));

const Test = request.Test;
Test.prototype.csrf = function csrf() {
  return this.set('X-CSRF-Token', csrfToken);
};
