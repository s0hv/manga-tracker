import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { fireEvent, screen, within } from '@testing-library/react';
import cookie from 'cookie';
import signature from 'cookie-signature';
import enLocale from 'date-fns/locale/en-GB';
import jestOpenAPI from 'jest-openapi';
import React, { isValidElement } from 'react';
import request from 'supertest';
import { QueryClient } from '@tanstack/react-query';

import { UserProvider } from '../src/utils/useUser';
import { getOpenapiSpecification } from '../swagger';

// Must be mocked here
jest.mock('notistack', () => {
  const actual = jest.requireActual('notistack');
  return {
    ...actual,
    useSnackbar: jest.fn().mockImplementation(actual.useSnackbar),
  };
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export const adminUser = {
  userId: 1,
  userUuid: '22fc15c9-37b9-4869-af86-b334333dedd8',
  username: 'test ci admin',
  joinedAt: new Date(Date.now()),
  theme: 2,
  admin: true,
  password: 'te!st-pa#ss)wo(rd123',
  email: 'test-admin@test.com',
};

export const normalUser = {
  userId: 3,
  uuid: 'cf5eddfd-e0fe-4e6e-b339-70be6f33794d',
  username: 'test ci',
  joinedAt: new Date(Date.now()),
  theme: 2,
  admin: false,
  password: 'te!st-pa#ss)wo(rd123',
  email: 'test@test.com',
};

export const authTestUser = {
  userId: 3,
  uuid: 'db598f65-c558-4205-937f-b0f149dda1fa',
  username: 'test ci auth',
  joinedAt: new Date(Date.now()),
  theme: 2,
  admin: false,
  password: 'te!st-pa#ss)wo(rd123',
  email: 'test_auth@test.com',
};

export const testManga = {
  mangaId: 2,
  title: 'ABCDEFG',
  latestChapter: 1,
  aliases: [
    'Test alias 2',
    'Test abc',
  ],
};


export const enqueueSnackbarMock = jest.fn();

/**
 * Must be called before every test. Import must as early as possible
 */
export function mockNotistackHooks() {
  enqueueSnackbarMock.mockReset();
  require('notistack').useSnackbar.mockReturnValue({ enqueueSnackbar: enqueueSnackbarMock });
}

export function expectSuccessSnackbar() {
  expect(enqueueSnackbarMock).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ variant: 'success' })
  );
}

export function expectErrorSnackbar(msg) {
  expect(enqueueSnackbarMock).toHaveBeenLastCalledWith(
    msg || expect.anything(),
    expect.objectContaining({ variant: 'error' })
  );
}

export function expectNoSnackbar() {
  expect(enqueueSnackbarMock).not.toHaveBeenCalled();
}

export function getSnackbarMessage() {
  return enqueueSnackbarMock.mock.calls[enqueueSnackbarMock.mock.calls.length-1][0];
}

export async function muiSelectValue(user, container, selectName, value) {
  await user.click(container.getByLabelText(selectName));
  const listbox = within(screen.getByRole('listbox'));

  fireEvent.click(listbox.getByText(value));
}

export function mockUTCDates() {
  jest.spyOn(Date.prototype, 'getDate')
    .mockImplementation(jest.fn(function getDate() {
      return this.getUTCDate();
    }));

  jest.spyOn(Date.prototype, 'getDay')
    .mockImplementation(jest.fn(function getDay() {
      return this.getUTCDay();
    }));

  jest.spyOn(Date.prototype, 'getFullYear')
    .mockImplementation(jest.fn(function getFullYear() {
      return this.getUTCFullYear();
    }));

  jest.spyOn(Date.prototype, 'getHours')
    .mockImplementation(jest.fn(function getHours() {
      return this.getUTCHours();
    }));

  jest.spyOn(Date.prototype, 'getMilliseconds')
    .mockImplementation(jest.fn(function getMilliseconds() {
      return this.getUTCMilliseconds();
    }));

  jest.spyOn(Date.prototype, 'getMinutes')
    .mockImplementation(jest.fn(function getMinutes() {
      return this.getUTCMinutes();
    }));

  jest.spyOn(Date.prototype, 'getMonth')
    .mockImplementation(jest.fn(function getMonth() {
      return this.getUTCMonth();
    }));

  jest.spyOn(Date.prototype, 'getSeconds')
    .mockImplementation(jest.fn(function getSeconds() {
      return this.getUTCSeconds();
    }));

  jest.spyOn(Date.prototype, 'getTimezoneOffset')
    .mockImplementation(jest.fn(() => 0));
}

export async function withUser(userObject, cb) {
  if (isValidElement(cb)) {
    return (
      <UserProvider value={userObject}>
        {cb}
      </UserProvider>
    );
  }
  const { requiresUser } = require('../db/auth');

  requiresUser.mockImplementation((req, res, next) => {
    req.user = userObject;
    next();
  });

  try {
    await cb();
  } finally {
    // Restore the original function
    requiresUser.mockImplementation(jest.requireActual('./../db/auth').requiresUser);
  }
}

export function getCookie(agent, name) {
  return agent.jar.getCookie(name, { path: '/' });
}

export function deleteCookie(agent, name) {
  const c = getCookie(agent, name);
  c.expiration_date = 0;
  agent.jar.setCookie(c);
}

export async function login(app, user, rememberMe=false) {
  const agent = request.agent(app);
  await agent
    .post('/api/login')
    .csrf()
    .send({
      email: user.email,
      password: user.password,
      rememberme: rememberMe,
    })
    .expect(302)
    .expect('set-cookie', /sess=/)
    .expect('set-cookie', rememberMe ? /auth=/ : /sess=/);

  if (!rememberMe) {
    expect(getCookie(agent, 'auth')).toBeUndefined();
  }

  expect(getCookie(agent, 'sess')).toBeDefined();

  return agent;
}

export const headerNotPresent =
  (header) => (res) => expect(res.header[header]).toBeUndefined();

export function unsignCookie(value) {
  if (!value.startsWith('s:')) {
    value = decodeURIComponent(value);
  }
  return signature.unsign(value.slice(2), 'secret');
}

export function getCookieFromRes(res, cookieName) {
  if (!res.headers['set-cookie']) return;
  return res.headers['set-cookie']
    .map(c => cookie.parse(c))
    .find(c => c[cookieName] !== undefined);
}

export function expectCookieDeleted(cookieName) {
  return (res) => {
    expect(res.headers['set-cookie']).toBeArray();
    const found = getCookieFromRes(res, cookieName);

    expect(found).toBeDefined();
    expect(new Date(found.Expires).getTime()).toBe(0);
  };
}

export function decodeAuthToken(tokenValue) {
  tokenValue = decodeURIComponent(tokenValue);
  const [lookup, token, uuidBase64] = tokenValue.split(';', 3);
  const uuid = Buffer.from(uuidBase64, 'base64').toString('ascii');
  return [lookup, token, uuid];
}

export function encodeAuthToken(lookup, token, uuid) {
  const uuidB64 = Buffer.from(uuid, 'ascii').toString('base64');
  return encodeURIComponent(`${lookup};${token};${uuidB64}`);
}

export function withRoot(Component) {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enLocale}>
      {Component}
    </LocalizationProvider>
  );
}

export function getErrorMessage(res) {
  expect(res.body).toBeObject();
  const errors = res.body.error;
  expect(errors).toBeDefined();
  return errors;
}

export function expectErrorMessage(value, param, message='Invalid value') {
  return (res) => {
    expect(res.body).toBeObject();
    let errors = res.body.error;
    expect(errors).toBeDefined();

    let error;

    if (typeof errors === 'string') {
      expect(errors).toMatch(value);
      return;
    }

    if (Array.isArray(errors)) {
      if (param) {
        // Only get errors related to the given parameter
        errors = errors.filter(err => err.param === param);
      }
      expect(errors).toHaveLength(1);
      error = errors[0];
    } else {
      error = errors;
    }

    expect(error.msg).toMatch(message);
    if (typeof param === 'string') {
      expect(error.param).toEqual(param);
    }

    expect(error.value).toEqual(value);
  };
}

export async function configureJestOpenAPI() {
  jestOpenAPI(await getOpenapiSpecification());
}

const counters = {};
export const getIncrementalStringGenerator = (name) => {
  if (counters[name] === undefined) {
    counters[name] = 0;
  }

  return () => `${name}_${counters[name]++}`;
};

/**
 *
 * @param {import('fetch-mock').MockCall | undefined} req
 * @param expectedBody
 */
export const expectRequestCalledWithBody = (req, expectedBody) => {
  expect(req).toBeDefined();

  const body = JSON.parse(req[1].body.toString());

  expect(body).toEqual(expectedBody);
};
