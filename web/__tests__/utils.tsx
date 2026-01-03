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
import { parseSetCookie } from 'cookie';
import signature from 'cookie-signature';
import { CookieAccessInfo } from 'cookiejar';
import { addHours } from 'date-fns';
import { enGB as enLocale } from 'date-fns/locale';
import fetchMock, { type MockCall } from 'fetch-mock';
import jestOpenAPI from 'jest-openapi';
import type { ConfirmResult } from 'material-ui-confirm';
import { SnackbarProvider } from 'notistack';
import type { Response } from 'supertest';
import request from 'supertest';
import { expect, Mock, MockInstance, vi } from 'vitest';

import { createTestSession } from '@/tests/dbutils';
import { type FrontendUser, UserStoreProvider } from '#web/store/userStore';
import type { DbHelpers } from '@/db/helpers';
import { serverCookieNames } from '@/serverUtils/constants';
import { ServiceForApi } from '@/types/api/services';

import { getOpenapiSpecification } from '../swagger';

import {
  authTokenCookieRegex,
  COOKIE_SECRET,
  sessionCookieRegex,
  testServices,
  TestUser,
} from './constants';

export { adminUser, authTestUser, normalUser, oauthUser } from './constants';

// Must be mocked here
vi.mock('notistack', async () => {
  const actual = await vi.importActual<typeof import('notistack')>('notistack');
  return {
    ...actual,
    useSnackbar: vi.fn().mockImplementation(actual.useSnackbar),
  };
});


// eslint-disable-next-line no-var
var dbMock: {
  db: DbHelpers
  any: Mock
};
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

type TestRootProps = {
  queryClient?: QueryClient
  user?: TestUser | null
};

export const TestRoot = ({ children, queryClient, user = null }: PropsWithChildren<TestRootProps>) => (
  <QueryClientProvider client={queryClient ?? getQueryClient()}>
    <UserStoreProvider user={user ? toFrontendUser(user) : user}>
      <SnackbarProvider>
        {children}
      </SnackbarProvider>
    </UserStoreProvider>
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
      <UserStoreProvider user={toFrontendUser(userObject)}>
        {cb}
      </UserStoreProvider>
    ) as any;
  }

  const { useSessionAndUser } = (await import('@/db/auth'));
  const useSessionAndUserMock = useSessionAndUser as Mock<typeof useSessionAndUser>;

  useSessionAndUserMock.mockImplementation(async (req, _, next) => {
    req.session = {
      sessionId: 'test',
      expiresAt: addHours(new Date(), 2),
      userId: userObject.userId,
      data: null,
    };
    req.user = userObject;
    next();
  });

  try {
    await cb();
  } finally {
    // Restore the original function
    useSessionAndUserMock.mockImplementation((await vi.importActual<typeof import('@/db/auth')>('@/db/auth')).useSessionAndUser);
  }
}) as WithUser;

export function getCookie(agent: request.Agent, name: string) {
  return agent.jar.getCookie(name, CookieAccessInfo.All);
}

function getAndAssertCookie(agent: request.Agent, name: string) {
  const cookie = getCookie(agent, name);
  expect(cookie).toBeDefined();
  return cookie!;
}

export function getSessionCookie(agent: request.Agent) {
  const cookie = getAndAssertCookie(agent, serverCookieNames.session);

  return {
    cookie,
    value: unsignCookie(cookie.value),
  };
}

export const getAuthTokenCookie = (agent: request.Agent) => {
  const cookie = getAndAssertCookie(agent, serverCookieNames.authToken);

  return {
    cookie,
    value: unsignCookie(cookie.value),
  };
};

export function expectCookieNotPresent(agent: request.Agent, name: string) {
  expect(getCookie(agent, name)).toBeUndefined();
}

export function expectCookiePresent(agent: request.Agent, name: string) {
  expect(getCookie(agent, name)).toBeDefined();
}

export function deleteCookie(agent: request.Agent, name: string) {
  const c = getCookie(agent, name);
  expect(c).toBeDefined();
  c!.expiration_date = 0;
  agent.jar.setCookie(c!);
}

export async function login(app: any, user: TestUser, rememberMe = false) {
  const agent = request.agent(app);

  // For oauth based accounts just mock the created session
  if (!user.isCredentialsAccount) {
    const sessionId = Date.now().toString();
    const { token } = await createTestSession(
      sessionId,
      user.userId
    );

    const tokenSigned = signCookieValue(token);
    const sessionCookie = serverCookieNames.session;

    agent.jar.setCookie(`${sessionCookie}=${tokenSigned}`);

    await agent
      .post('/api/authCheck')
      .csrf()
      .expect(200)
      .expect(res => expect(res.body.user).toBeObject());

    expect(getCookie(agent, sessionCookie)).toBeDefined();

    return agent;
  }

  await agent
    .post('/api/auth/login')
    .csrf()
    .send({
      email: user.email,
      password: user.password,
      rememberMe,
    })
    .expect(302)
    .expect('set-cookie', sessionCookieRegex)
    .expect('set-cookie', rememberMe ? authTokenCookieRegex : sessionCookieRegex);

  if (!rememberMe) {
    expect(getCookie(agent, serverCookieNames.authToken)).toBeUndefined();
  }

  expect(getCookie(agent, serverCookieNames.session)).toBeDefined();

  return agent;
}

export const headerNotPresent =
  (header: string) => (res: Response) => expect(res.header[header]).toBeUndefined();

export function unsignCookie(value: string) {
  const unsigned = signature.unsign(decodeURIComponent(value).slice(2), COOKIE_SECRET);
  expect(unsigned).toBeString();

  return unsigned as string;
}

export function signCookieValue(value: string) {
  return encodeURIComponent(`s:${signature.sign(value, COOKIE_SECRET)}`);
}

export function getCookieFromRes(res: Response, cookieName: string) {
  if (!res.headers['set-cookie']) return;
  expect(res.headers['set-cookie']).toBeArray();

  return (res.headers['set-cookie'] as unknown as string[])
    .map(setCookie => parseSetCookie(setCookie))
    .find(cookie => cookie.name === cookieName);
}

export function expectCookieDeleted(cookieName: string) {
  return (res: Response) => {
    const found = getCookieFromRes(res, cookieName);

    expect(found).toBeDefined();
    expect(found!.expires?.getTime()).toStrictEqual(0);
  };
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


export function getErrorMessage2(res: Response, param?: string, part: 'body' | 'param' | 'query' = 'body'): string | undefined {
  expect(res.ok).toBeFalse();
  expect(res.body).toBeObject();
  const errors = res.body.error;
  expect(errors).toBeDefined();

  if (typeof errors === 'string') {
    return errors;
  }

  if (typeof errors === 'object') {
    let errorEntries = Object.entries(errors);

    if (param) {
      const paramName = `${part}.${param}`;
      // Only get errors related to the given parameter
      errorEntries = errorEntries.filter(([key]) => key === paramName);
    }
    expect(errorEntries, `Error message for field '${param}' not found in ${part}`).toHaveLength(1);
    return (errorEntries[0][1] as string[]).join('\n');
  }
}

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
  }), {}) as DbHelpers;
  // Leave `sql` as is since it's an object
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

export function toFrontendUser(user: TestUser): FrontendUser {
  return {
    uuid: user.userUuid,
    username: user.username,
    theme: user.theme,
    admin: user.admin,
  };
}

export function getCoverUrl(cover: string, size?: 256 | 512 | undefined): string;
export function getCoverUrl(cover: string | undefined | null, size?: 256 | 512 | undefined): string | undefined;
export function getCoverUrl(cover: string | undefined | null, size: 256 | 512 | undefined = 256) {
  if (cover == undefined) {
    return;
  }

  const coverUrl = new URL(cover);

  if (coverUrl.hostname !== 'uploads.mangadex.org') {
    return cover;
  }

  const [_, __, mangaId, coverId] = coverUrl.pathname.split('/');
  const sizeParam = size
    ? `?size=${size}`
    : '';

  return `/thumbnails/mangadex/${mangaId}/${coverId}${sizeParam}`;
}
