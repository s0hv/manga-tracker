/* eslint-disable import/no-extraneous-dependencies */
import '@testing-library/jest-dom/extend-expect';
import 'jest-extended';

import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });

require('dotenv').config({ path: '../.env' });

jest.mock('./db/mangadex', () => ({
  ...jest.requireActual('./db/manga'),
  fetchExtraInfo: jest.fn().mockImplementation(async () => {}),
}));
