import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { fireEvent, screen, within } from '@testing-library/react';
import cookie from 'cookie';
import signature from 'cookie-signature';
import enLocale from 'date-fns/locale/en-GB';
import jestOpenAPI from 'jest-openapi';
import React, { isValidElement } from 'react';
import type { Response } from 'supertest';
import request from 'supertest';
import { QueryClient } from '@tanstack/react-query';
import type { MockCall } from 'fetch-mock';
import type {
  NextFunction,
  Request as ExpressRequest,
} from 'express-serve-static-core';
import userEvent from '@testing-library/user-event';
import type { Screen } from '@testing-library/react/types';

import { UserProvider } from '@/webUtils/useUser';
import { getOpenapiSpecification } from '../swagger';
import type { User } from '@/types/db/user';
import type { SessionUser } from '@/types/dbTypes';

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

export type TestUser = User & SessionUser & {
  joinedAt: Date
  password: string
  email: string
}

export const adminUser: TestUser = {
  userId: 1,
  userUuid: '22fc15c9-37b9-4869-af86-b334333dedd8',
  uuid: '22fc15c9-37b9-4869-af86-b334333dedd8',
  username: 'test ci admin',
  joinedAt: new Date(Date.now()),
  theme: 2,
  admin: true,
  password: 'te!st-pa#ss)wo(rd123',
  email: 'test-admin@test.com',
};

export const normalUser: TestUser = {
  userId: 3,
  userUuid: 'cf5eddfd-e0fe-4e6e-b339-70be6f33794d',
  uuid: 'cf5eddfd-e0fe-4e6e-b339-70be6f33794d',
  username: 'test ci',
  joinedAt: new Date(Date.now()),
  theme: 2,
  admin: false,
  password: 'te!st-pa#ss)wo(rd123',
  email: 'test@test.com',
};

export const authTestUser: TestUser = {
  userId: 3,
  userUuid: 'db598f65-c558-4205-937f-b0f149dda1fa',
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('notistack').useSnackbar.mockReturnValue({ enqueueSnackbar: enqueueSnackbarMock });
}

export function expectSuccessSnackbar() {
  expect(enqueueSnackbarMock).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ variant: 'success' })
  );
}

export function expectErrorSnackbar(msg?: string | RegExp) {
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

export async function muiSelectValue(user: ReturnType<typeof userEvent.setup>, container: Screen, selectName: string | RegExp, value: string | RegExp) {
  await user.click(container.getByLabelText(selectName));
  const listbox = within(screen.getByRole('listbox'));

  fireEvent.click(listbox.getByText(value));
}

export function mockUTCDates() {
  jest.spyOn(Date.prototype, 'getDate')
    .mockImplementation(jest.fn(function getDate(this: Date) {
      return this.getUTCDate();
    }));

  jest.spyOn(Date.prototype, 'getDay')
    .mockImplementation(jest.fn(function getDay(this: Date) {
      return this.getUTCDay();
    }));

  jest.spyOn(Date.prototype, 'getFullYear')
    .mockImplementation(jest.fn(function getFullYear(this: Date) {
      return this.getUTCFullYear();
    }));

  jest.spyOn(Date.prototype, 'getHours')
    .mockImplementation(jest.fn(function getHours(this: Date) {
      return this.getUTCHours();
    }));

  jest.spyOn(Date.prototype, 'getMilliseconds')
    .mockImplementation(jest.fn(function getMilliseconds(this: Date) {
      return this.getUTCMilliseconds();
    }));

  jest.spyOn(Date.prototype, 'getMinutes')
    .mockImplementation(jest.fn(function getMinutes(this: Date) {
      return this.getUTCMinutes();
    }));

  jest.spyOn(Date.prototype, 'getMonth')
    .mockImplementation(jest.fn(function getMonth(this: Date) {
      return this.getUTCMonth();
    }));

  jest.spyOn(Date.prototype, 'getSeconds')
    .mockImplementation(jest.fn(function getSeconds(this: Date) {
      return this.getUTCSeconds();
    }));

  jest.spyOn(Date.prototype, 'getTimezoneOffset')
    .mockImplementation(jest.fn(() => 0));
}

export async function withUser(userObject: TestUser, cb: React.FC | (() => Promise<any>)) {
  if (isValidElement(cb)) {
    return (
      <UserProvider value={userObject}>
        {cb}
      </UserProvider>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { requiresUser } = require('../db/auth');

  requiresUser.mockImplementation((req: ExpressRequest, res: any, next: NextFunction) => {
    req.user = userObject;
    next();
  });

  try {
    await (cb as () => Promise<any>)();
  } finally {
    // Restore the original function
    requiresUser.mockImplementation(jest.requireActual('./../db/auth').requiresUser);
  }
}

export function getCookie(agent: request.SuperAgentTest, name: string) {
  return agent.jar.getCookie(name, { path: '/' } as any);
}

export function deleteCookie(agent: request.SuperAgentTest, name: string) {
  const c = getCookie(agent, name);
  expect(cookie).toBeDefined();
  c!.expiration_date = 0;
  agent.jar.setCookie(c!);
}

export async function login(app: any, user: TestUser, rememberMe=false) {
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
  (header: string) => (res: Response) => expect(res.header[header]).toBeUndefined();

export function unsignCookie(value: string) {
  if (!value.startsWith('s:')) {
    value = decodeURIComponent(value);
  }
  return signature.unsign(value.slice(2), 'secret');
}

export function getCookieFromRes(res: Response, cookieName: string) {
  if (!res.headers['set-cookie']) return;
  return res.headers['set-cookie']
    .map((c: string) => cookie.parse(c))
    .find((c: Record<string, string>) => c[cookieName] !== undefined);
}

export function expectCookieDeleted(cookieName: string) {
  return (res: Response) => {
    expect(res.headers['set-cookie']).toBeArray();
    const found = getCookieFromRes(res, cookieName);

    expect(found).toBeDefined();
    expect(new Date(found.Expires).getTime()).toBe(0);
  };
}

export function decodeAuthToken(tokenValue: string): [string, string, string] {
  tokenValue = decodeURIComponent(tokenValue);
  const [lookup, token, uuidBase64] = tokenValue.split(';', 3);
  const uuid = Buffer.from(uuidBase64, 'base64').toString('ascii');
  return [lookup, token, uuid];
}

export function encodeAuthToken(lookup: string, token: string, uuid: string): string {
  const uuidB64 = Buffer.from(uuid, 'ascii').toString('base64');
  return encodeURIComponent(`${lookup};${token};${uuidB64}`);
}

export function withRoot(Component: React.ReactElement): React.ReactElement {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enLocale}>
      {Component}
    </LocalizationProvider>
  );
}

export function getErrorMessage(res: Response) {
  expect(res.body).toBeObject();
  const errors = res.body.error;
  expect(errors).toBeDefined();
  return errors;
}

type ExpectErrorMessageReturn = (res: Response) => void;
type ExpectErrorMessage = {
  (value: string, param?: string, message?: string | RegExp): ExpectErrorMessageReturn
}

export const expectErrorMessage: ExpectErrorMessage = (value, param, message='Invalid value') => {
  return (res: Response) => {
    expect(res.ok).toBeFalse();
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
};

export async function configureJestOpenAPI() {
  jestOpenAPI(await getOpenapiSpecification());
}

const counters: Record<string, number> = {};
export const getIncrementalStringGenerator = (name: string) => {
  if (counters[name] === undefined) {
    counters[name] = 0;
  }

  return () => `${name}_${counters[name]++}`;
};

export const expectRequestCalledWithBody = (req: MockCall | undefined, expectedBody: any) => {
  expect(req).toBeDefined();
  expect(req![1]?.body).toBeDefined();

  const body = JSON.parse(req![1]!.body!.toString());

  expect(body).toEqual(expectedBody);
};

export const getRowByColumnValue = (
  table: HTMLTableElement,
  header: string | RegExp,
  valueCheck: (elem: HTMLTableCellElement) => boolean
): HTMLTableRowElement | undefined => {
  /**
   * @type {HTMLTableRowElement}
   */
  const headerRow = table.querySelector('thead tr') as HTMLTableRowElement;

  if (!headerRow) throw new Error('Header row not found');

  const headerComp = typeof header === 'string' ?
    (v: Element) => v.textContent === header :
    (v: Element) => header.test(v.textContent || '');

  const headerIndex = Array.from(headerRow.cells).findIndex(headerComp);

  if (headerIndex < 0) throw new Error(`Header index not found for "${header}"`);

  const rows = table.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (valueCheck(row.cells[headerIndex])) return row;
  }
};
