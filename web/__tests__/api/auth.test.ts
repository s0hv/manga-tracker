import { addHours, differenceInMilliseconds } from 'date-fns';
import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  authTokenCount,
  authTokenExists,
  expectAuthTokenRegenerated,
  sessionAssociatedWithUser,
  userSessionCount,
} from '../dbutils';
import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  adminUser,
  authTestUser,
  deleteCookie,
  expectCookieDeleted,
  expectCookieNotPresent,
  expectCookiePresent,
  expectErrorMessage,
  getAuthTokenCookie,
  getCookieFromRes,
  getErrorMessage2,
  getSessionCookie,
  login,
  normalUser,
  signCookieValue,
} from '../utils';
import { clearUserCache } from '#server/db/user';
import { formatAuthToken, parseAuthCookie } from '@/db/auth';
import { csrfMissing, serverCookieNames } from '@/serverUtils/constants';
import { redis } from '@/serverUtils/ratelimits';
import { authTokenCookieRegex, sessionCookieRegex } from '@/tests/constants';

let httpServer: any;
const serverReference = {
  httpServer,
};

beforeAll(async () => {
  ({ httpServer } = await initServer());
  serverReference.httpServer = httpServer;
});

afterAll(async () => {
  await stopServer(httpServer);
});

beforeEach(async () => {
  await redis.flushall();
});

const fakeUser = {
  email: 'a@b.c',
  password: 'aaaaaaa',
};

const wrongPassword = {
  email: normalUser.email,
  password: normalUser.password + 'a',
};

const wrongEmail = {
  email: normalUser.email + 'a',
  password: normalUser.password,
};

const tooLongPassword = {
  email: normalUser.email,
  password: '123412341234123412341234123412341234123412341234'.repeat(3),
};

const realUser = {
  email: normalUser.email,
  password: normalUser.password,
};


function getAuthTokenCookieSigned(lookup: string, token: Uint8Array, userUUID: string) {
  return signCookieValue(
    formatAuthToken(lookup, token, userUUID)
  );
}


describe('POST /api/auth/login', () => {
  const url = '/api/auth/login';

  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post(url)
      .send(realUser)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('Returns 400 with only email or password or nothing', async () => {
    await request(httpServer)
      .post(url)
      .csrf()
      .send({})
      .expect(400);

    await request(httpServer)
      .post(url)
      .csrf()
      .expect(400);

    await request(httpServer)
      .post(url)
      .csrf()
      .send({ email: 'test' })
      .expect(res => expect(getErrorMessage2(res, 'password'))
        .toMatchInlineSnapshot(`"Invalid input: expected string, received undefined"`))
      .expect(400);

    await request(httpServer)
      .post(url)
      .csrf()
      .send({ password: 'test' })
      .expect(res => expect(getErrorMessage2(res, 'email'))
        .toMatchInlineSnapshot(`"Invalid input: expected string, received undefined"`))
      .expect(400);
  });

  it('Returns 400 with extra properties', async () => {
    await request(httpServer)
      .post(url)
      .csrf()
      .send({
        ...realUser,
        extra: 'test',
      })
      .expect(400)
      .expect(res => expect(getErrorMessage2(res, ''))
        .toMatchInlineSnapshot(`"Unrecognized key: "extra""`));
  });

  it.each([
    [wrongEmail, 'wrongEmail'],
    [wrongPassword, 'wrongPassword'],
    [tooLongPassword, 'tooLongPassword'],
    [fakeUser, 'fakeUser'],
  ])('Returns 401 with invalid credentials: $1', async body => {
    await request(httpServer)
      .post(url)
      .csrf()
      .send(body)
      .redirects(0)
      .expect(401);
  });

  it('Returns 200 with valid user', async () => {
    await request(httpServer)
      .post(url)
      .csrf()
      .send(realUser)
      .redirects(0)
      .expect('set-cookie', sessionCookieRegex)
      .expect(res => expect(getCookieFromRes(res, serverCookieNames.authToken)).toBeUndefined())
      .expect(302);

    await request(httpServer)
      .post(url)
      .csrf()
      .send({
        ...realUser,
        rememberMe: true,
      })
      .redirects(0)
      .expect('set-cookie', sessionCookieRegex)
      .expect('set-cookie', authTokenCookieRegex)
      .expect(302);
  });

  it('Ratelimits on bruteforce attempts failures', async () => {
    await Promise.all(
      Array(6)
        .fill(0)
        .map(() => request(httpServer)
          .post(url)
          .csrf()
          .send(fakeUser))
    );

    let nextValidRequestDate: Date | undefined;

    await request(httpServer)
      .post(url)
      .csrf()
      .send(fakeUser)
      .expect(429)
      .expect(res => { nextValidRequestDate = new Date(res.body.error.nextValidRequestDate) });

    // Login attempts block further logins by 24 hours
    expect(new Date(nextValidRequestDate!)).toBeAfter(addHours(new Date(), 23));

    await request(httpServer)
      .post(url)
      .csrf()
      .send(fakeUser)
      .expect(429)
      .expect(res => {
        const dateDiff = differenceInMilliseconds(nextValidRequestDate!, new Date(res.body.error.nextValidRequestDate));
        // The limit can vary by a few milliseconds, which is fine
        expect(dateDiff).toBeLessThan(10);
      });
  });
});


describe('POST /api/auth/logout', () => {
  const url = '/api/auth/logout';

  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post(url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('Returns 302 without logging in', async () => {
    await request(httpServer)
      .post(url)
      .csrf()
      .expect(302);
  });

  it('Returns 302 with login and without remember me', async () => {
    const agent = await login(httpServer, normalUser);
    const sess = getSessionCookie(agent);

    await agent
      .post(url)
      .csrf()
      .expect('location', '/')
      .expect(expectCookieDeleted(serverCookieNames.session))
      .expect(302);

    expectCookieNotPresent(agent, serverCookieNames.session);
    expect(await sessionAssociatedWithUser(sess.value)).toBeFalse();
  });

  it('Returns 302 with login and remember me', async () => {
    const agent = await login(httpServer, normalUser, true);
    const sess = getSessionCookie(agent);
    const auth = getAuthTokenCookie(agent);

    await agent
      .post(url)
      .csrf()
      .expect('location', '/')
      .expect(expectCookieDeleted(serverCookieNames.session))
      .expect(expectCookieDeleted(serverCookieNames.authToken))
      .expect(302);

    expectCookieNotPresent(agent, serverCookieNames.session);
    expectCookieNotPresent(agent, serverCookieNames.authToken);

    expect(await sessionAssociatedWithUser(sess.value)).toBeFalse();
    // Auth token should still exists after logout
    expect(await authTokenExists(auth.value)).toBeTrue();
  });

  it('Redirects to the correct page according to the redirect cookie', async () => {
    const agent = await login(httpServer, normalUser);
    const redirectUrl = '/manga/1';

    await agent
      .post(url)
      .csrf()
      .set('Referer', `http://localhost${redirectUrl}`)
      .expect('location', redirectUrl)
      .expect(302);

    await agent
      .post(url)
      .csrf()
      .set('Referer', 'http://localhost')
      .expect('location', '/')
      .expect(302);
  });

  it('Does not redirects to external domains or api endpoints', async () => {
    const agent = await login(httpServer, normalUser);
    const redirectUrl = '/test';

    await agent
      .post(url)
      .csrf()
      .set('Referer', `https://external-site.com${redirectUrl}`)
      .expect('location', redirectUrl)
      .expect(302);

    await agent
      .post(url)
      .csrf()
      .set('Referer', `http://localhost/api/test`)
      .expect('location', '/')
      .expect(302);
  });
});

describe('Test authentication', () => {
  function getRestoreLogin(agent: Agent, cookies?: string[]) {
    const cookiesHeader = [
      `${serverCookieNames.authRestore}=1`,
      ...(cookies ?? []),
    ].join('; ');

    return agent
      .get('/')
      .set('sec-fetch-mode', 'navigate')
      .set('sec-fetch-dest', 'document')
      .set('Cookie', cookiesHeader)
      .redirects(1);
  }

  it('/api/authCheck does not work with an invalid auth token', async () => {
    const token = signCookieValue('aeffaf.argregtrsegikogtgetrh.arteiogfjaoeirjg');
    await getRestoreLogin(request(httpServer), [`${serverCookieNames.authToken}=${token}`])
      .expect(302)
      .expect('location', '/')
      .expect(expectCookieDeleted(serverCookieNames.authToken))
      .expect(expectCookieDeleted(serverCookieNames.session));
  });

  it('Invalidates all tokens and sessions when uuid and lookup are correct', async () => {
    const agent = await login(httpServer, authTestUser, true);
    const auth = getAuthTokenCookie(agent);
    const sess = getSessionCookie(agent);
    deleteCookie(agent, serverCookieNames.authToken);
    deleteCookie(agent, serverCookieNames.session);

    const authToken = parseAuthCookie(auth.value)!;
    expect(authToken).toBeDefined();

    const fakeToken = getAuthTokenCookieSigned(
      authToken.lookup,
      authToken.token.reverse(),
      authToken.userUUID
    );

    agent.jar.setCookie(`${serverCookieNames.authToken}=${fakeToken}`);

    await getRestoreLogin(agent)
      .expect(302)
      .expect(expectCookieDeleted(serverCookieNames.authToken))
      .expect(expectCookieDeleted(serverCookieNames.session));

    // Make sure sessions and tokens deleted
    expect(await authTokenCount(authTestUser.userUuid)).toBe(0);
    expect(await userSessionCount(authTestUser.userUuid)).toBe(0);

    // Make sure the session does not exist
    await request(httpServer)
      .post('/api/authCheck')
      .csrf()
      .set('Cookie', `${serverCookieNames.session}=${sess.value}`)
      .expect(401);
  });

  it('Does not work with correct token and lookup, but wrong uuid', async () => {
    const agent = await login(httpServer, adminUser, true);
    const auth = getAuthTokenCookie(agent);
    deleteCookie(agent, serverCookieNames.authToken);
    deleteCookie(agent, serverCookieNames.session);

    const authToken = parseAuthCookie(auth.value)!;
    expect(authToken).toBeDefined();

    const fakeToken = getAuthTokenCookieSigned(
      authToken.lookup,
      authToken.token.reverse(),
      authToken.userUUID.split('').reverse().join('')
    );

    agent.jar.setCookie(`${serverCookieNames.authToken}=${fakeToken}`);

    await getRestoreLogin(agent)
      .expect(expectCookieDeleted(serverCookieNames.authToken))
      .expect(expectCookieDeleted(serverCookieNames.session));

    const uuid = authToken.userUUID;
    expect(await authTokenCount(uuid)).toBeGreaterThan(0);
    expect(await userSessionCount(uuid)).toBeGreaterThan(0);
  });

  it('Regenerates token when presenting auth but no session', async () => {
    const agent = await login(httpServer, adminUser, true);
    const auth = getAuthTokenCookie(agent);
    deleteCookie(agent, serverCookieNames.session);

    await getRestoreLogin(agent)
      .redirects(2)
      .expect(200);

    expectCookiePresent(agent, serverCookieNames.session);

    await expectAuthTokenRegenerated(agent, auth.value);
  });

  it('Finds user when it is not in the cache', async () => {
    const agent = await login(httpServer, adminUser, true);
    const auth = getAuthTokenCookie(agent);
    deleteCookie(agent, serverCookieNames.session);
    clearUserCache();

    await getRestoreLogin(agent)
      .redirects(2)
      .expect(200);

    expectCookiePresent(agent, serverCookieNames.session);
    await expectAuthTokenRegenerated(agent, auth.value);
    clearUserCache();

    await agent
      .post('/api/authCheck')
      .csrf()
      .expect('content-type', /json/)
      .expect(200);
  });

  it('Resets cookie with invalid uuid', async () => {
    const agent = await login(httpServer, adminUser, true);
    const auth = getAuthTokenCookie(agent);
    deleteCookie(agent, serverCookieNames.authToken);
    deleteCookie(agent, serverCookieNames.session);

    const authToken = parseAuthCookie(auth.value)!;
    expect(authToken).toBeDefined();

    const fakeToken = getAuthTokenCookieSigned(
      authToken.lookup,
      authToken.token,
      authToken.userUUID + 'a'
    );

    agent.jar.setCookie(`${serverCookieNames.authToken}=${fakeToken}`);

    await getRestoreLogin(agent)
      .redirects(1)
      .expect(302)
      .expect(expectCookieDeleted(serverCookieNames.authToken));
  });

  it('Ratelimits with many requests with correct lookup but wrong token', async () => {
    const agent = await login(httpServer, adminUser, true);
    const auth = getAuthTokenCookie(agent);

    const authToken = parseAuthCookie(auth.value)!;
    expect(authToken).toBeDefined();

    const fakeToken = getAuthTokenCookieSigned(
      authToken.lookup,
      authToken.token.reverse(),
      authToken.userUUID
    );

    await Promise.all(Array(6)
      .fill(0)
      .map(() =>
        getRestoreLogin(request(httpServer), [`${serverCookieNames.authToken}=${fakeToken}`])
          .redirects(2)));

    await getRestoreLogin(request(httpServer), [`${serverCookieNames.authToken}=${signCookieValue(auth.value)}`])
      .redirects(2)
      .expect(429)
      .expect(res => {
        const ratelimitedUntil = new Date(res.body.error.nextValidRequestDate);

        expect(ratelimitedUntil).toBeAfter(addHours(new Date(), 23));
      });

    // Make sure sessions and tokens deleted
    expect(await authTokenCount(authTestUser.userUuid)).toBe(0);
    expect(await userSessionCount(authTestUser.userUuid)).toBe(0);
  });
});
