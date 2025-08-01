import React, { type PropsWithChildren, isValidElement } from 'react';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BoundFunctions,
  queries,
  screen,
  within,
} from '@testing-library/react';
import { type UserEvent } from '@testing-library/user-event';
import signature from 'cookie-signature';
import { enGB as enLocale } from 'date-fns/locale';
import type {
  NextFunction,
  Request as ExpressRequest,
} from 'express-serve-static-core';
import fetchMock, { type MockCall } from 'fetch-mock';
import jestOpenAPI from 'jest-openapi';
import type { ConfirmResult } from 'material-ui-confirm';
import { SnackbarProvider } from 'notistack';
import type { Response } from 'supertest';
import request from 'supertest';
import { expect, Mock, MockInstance, vi } from 'vitest';

import type { PostgresAdapter } from '@/db/postgres-adapter';
import { ServiceForApi } from '@/types/api/services';
import { UserProvider } from '@/webUtils/useUser';

import { getOpenapiSpecification } from '../swagger';

import { testServices, TestUser } from './constants';

export { adminUser, authTestUser, normalUser, oauthUser } from './constants';

// Must be mocked here
vi.mock('notistack', async () => {
  const actual = await vi.importActual<typeof import('notistack')>('notistack');
  return {
    ...actual,
    useSnackbar: vi.fn().mockImplementation(actual.useSnackbar),
  };
});

let dbMock: any;
vi.mock('@/db/helpers', async () => {
  const db = await vi.importActual<typeof import('@/db/helpers')>('@/db/helpers');
  dbMock = {
    ...db,
    any: vi.fn().mockImplementation(() => {
      throw new Error('aaaaaaaa');
    }),
  };
  return dbMock;
});

const getQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: 'always',
    },
  },
});

export const queryClient = getQueryClient();

export const TestRoot = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={getQueryClient()}>
    <SnackbarProvider>
      {children}
    </SnackbarProvider>
  </QueryClientProvider>
);

export const convertToOauthUser = (u: TestUser): TestUser => ({
  ...u,
  isCredentialsAccount: false,
});

export const testManga = {
  mangaId: 2,
  title: 'ABCDEFG',
  latestChapter: 1,
  aliases: [
    'Test alias 2',
    'Test abc',
  ],
};


export const enqueueSnackbarMock = vi.fn();

/**
 * Must be called before every test. Import must as early as possible
 */
export async function mockNotistackHooks() {
  enqueueSnackbarMock.mockReset();
  ((await import('notistack')).useSnackbar as Mock).mockReturnValue({ enqueueSnackbar: enqueueSnackbarMock } as any);
}

export function expectSuccessSnackbar() {
  expect(enqueueSnackbarMock).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ variant: 'success' })
  );
}

export function expectErrorSnackbar(msg?: string) {
  expect(enqueueSnackbarMock).toHaveBeenLastCalledWith(
    msg || expect.anything(),
    expect.objectContaining({ variant: 'error' })
  );
}

export function expectNoSnackbar() {
  expect(enqueueSnackbarMock).not.toHaveBeenCalled();
}

export function getSnackbarMessage() {
  return enqueueSnackbarMock.mock.calls[enqueueSnackbarMock.mock.calls.length - 1][0];
}

export async function muiSelectValue(user: UserEvent, container: BoundFunctions<typeof queries>, selectName: string | RegExp, value: string | RegExp) {
  await user.click(container.getByRole('combobox', { name: selectName }));
  const listbox = within(screen.getByRole('listbox'));

  await user.click(listbox.getByRole('option', { name: value }));
}

export function mockUTCDates() {
  vi.spyOn(Date.prototype, 'getDate')
    .mockImplementation(vi.fn(function getDate(this: Date) {
      return this.getUTCDate();
    }));

  vi.spyOn(Date.prototype, 'getDay')
    .mockImplementation(vi.fn(function getDay(this: Date) {
      return this.getUTCDay();
    }));

  vi.spyOn(Date.prototype, 'getFullYear')
    .mockImplementation(vi.fn(function getFullYear(this: Date) {
      return this.getUTCFullYear();
    }));

  vi.spyOn(Date.prototype, 'getHours')
    .mockImplementation(vi.fn(function getHours(this: Date) {
      return this.getUTCHours();
    }));

  vi.spyOn(Date.prototype, 'getMilliseconds')
    .mockImplementation(vi.fn(function getMilliseconds(this: Date) {
      return this.getUTCMilliseconds();
    }));

  vi.spyOn(Date.prototype, 'getMinutes')
    .mockImplementation(vi.fn(function getMinutes(this: Date) {
      return this.getUTCMinutes();
    }));

  vi.spyOn(Date.prototype, 'getMonth')
    .mockImplementation(vi.fn(function getMonth(this: Date) {
      return this.getUTCMonth();
    }));

  vi.spyOn(Date.prototype, 'getSeconds')
    .mockImplementation(vi.fn(function getSeconds(this: Date) {
      return this.getUTCSeconds();
    }));

  vi.spyOn(Date.prototype, 'getTimezoneOffset')
    .mockImplementation(vi.fn(() => 0));
}

type WithUser = {
  (userObject: TestUser, cb: React.ReactElement): Promise<React.ReactElement>
  (userObject: TestUser, cb: () => Promise<any>): Promise<void>
};

export const withUser: WithUser = (async (userObject: TestUser, cb: React.ReactElement | (() => Promise<any>)) => {
  if (isValidElement(cb)) {
    return (
      <UserProvider value={userObject}>
        {cb}
      </UserProvider>
    ) as any;
  }

  const { getSessionAndUser } = (await import('@/db/auth')) as any as { getSessionAndUser: Mock };

  getSessionAndUser.mockImplementation((req: ExpressRequest, res: any, next: NextFunction) => {
    req.session = {
      userId: userObject.uuid as never,
    };
    req.user = userObject;
    next();
  });

  try {
    await (cb as () => Promise<any>)();
  } finally {
    // Restore the original function
    getSessionAndUser.mockImplementation((await vi.importActual<typeof import('@/db/auth')>('@/db/auth')).getSessionAndUser);
  }
}) as WithUser;

export function getCookie(agent: request.Agent, name: string) {
  return agent.jar.getCookie(name, { path: '/' } as any);
}

export const getSessionToken = (agent: request.Agent) => {
  return getCookie(agent, 'next-auth.session-token')?.value;
};

export function deleteCookie(agent: request.Agent, name: string) {
  const c = getCookie(agent, name);
  expect(c).toBeDefined();
  c!.expiration_date = 0;
  agent.jar.setCookie(c!);
}

export async function login(app: any, user: TestUser) {
  const agent = request.agent(app);
  const { db } = await import('@/db/helpers');
  // Stuff breaks if this import is hoisted at the top of the file
  const { PostgresAdapter } = await import('@/db/postgres-adapter');
  const adapter: PostgresAdapter = PostgresAdapter(db);

  const token = Date.now().toString();
  await adapter.createSession({
    sessionToken: token,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    userId: user.id,
  });

  const authCookie = 'next-auth.session-token';
  agent.jar.setCookie(`${authCookie}=${token}`);

  await agent
    .post('/api/authCheck')
    .csrf()
    .expect(200)
    .expect(res => expect(res.body.user).toBeObject());

  expect(getCookie(agent, authCookie)).toBeDefined();

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
  (value: any, param?: string, message?: string | RegExp): ExpectErrorMessageReturn
};

export const expectErrorMessage: ExpectErrorMessage = (value, param, message = 'Invalid value') => {
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
        errors = errors.filter(err => err.path === param);
      }
      expect(errors).toHaveLength(1);
      error = errors[0];
    } else {
      error = errors;
    }

    expect(error.msg).toMatch(message);
    if (typeof param === 'string') {
      expect(error.path).toEqual(param);
    }

    expect(error.value).toEqual(value);
  };
};

export async function configureJestOpenAPI() {
  // Must add global expect so that jest-openapi can add its custom matchers
  (global as any).expect = expect;
  jestOpenAPI(await getOpenapiSpecification() as any);
  delete (global as any).expect;
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

  const headerComp = typeof header === 'string'
    ? (v: Element) => v.textContent === header
    : (v: Element) => header.test(v.textContent || '');

  const headerIndex = Array.from(headerRow.cells).findIndex(headerComp);

  if (headerIndex < 0) throw new Error(`Header index not found for "${header}"`);

  const rows = table.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (valueCheck(row.cells[headerIndex])) return row;
  }
};

export const mockDbForErrors = <T, >(fn: () => Promise<T>): Promise<T> => {
  const originalDb = dbMock.db;
  const sql = originalDb.sql;

  dbMock.db = Object.keys(originalDb).reduce((prev, curr) => ({
    ...prev,
    [curr]: vi.fn().mockImplementation(async () => Promise.reject('Mocked error')),
  }), {});
  // Leave sql as is since it's an object
  dbMock.db.sql = sql;

  return fn()
    .finally(() => {
      dbMock.db = originalDb;
    });
};

type SilenceConsole = {
  (): MockInstance[]
  <T>(callback: Promise<T>): Promise<T>
};
export const silenceConsole: SilenceConsole = (<T, >(callback?: Promise<T>): Promise<T> | MockInstance[] => {
  if (process.env.KEEP_CONSOLE) {
    return callback || [];
  }
  const spies = [
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'error').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'info').mockImplementation(() => {}),
    vi.spyOn(console, 'debug').mockImplementation(() => {}),
  ];

  if (callback !== undefined) {
    return callback
      .finally(() => {
        spies.forEach(spy => spy.mockRestore());
      });
  }

  return spies;
}) as SilenceConsole;

export const restoreMocks = (spies: MockInstance[]) => spies.forEach(spy => spy.mockRestore());

export const confirmMock = (confirmed: boolean = true) => vi.fn(() => Promise.resolve(
  { confirmed, reason: confirmed ? 'confirm' : 'cancel' } satisfies ConfirmResult
));

export const mockServicesEndpoint = () => {
  const servicesMock = vi.fn();
  servicesMock.mockImplementation(() => Promise.resolve(testServices satisfies ServiceForApi[]));

  fetchMock.get('path:/api/services', servicesMock, { overwriteRoutes: true });

  return servicesMock;
};
