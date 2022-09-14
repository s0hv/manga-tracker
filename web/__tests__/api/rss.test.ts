import request, { type Test } from 'supertest';

import initServer from '../initServer';
import stopServer from '../stopServer';
import { normalUser } from '../utils';

let httpServer: any;
const BASE_URL = 'http://localhost:3000';
process.env.BASE_URL = BASE_URL;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

afterAll(async () => {
  await stopServer(httpServer);
});

describe('GET /rss', () => {
  const expectSuccessfulRss = (supertest: Test) => supertest
    .expect(200)
    .expect('Content-Type', 'application/rss+xml')
    .expect(res => expect(res.text.length).toBeGreaterThan(0));

  it('Returns 404 with invalid uuid', async () => {
    await request(httpServer)
      .get('/rss/a')
      .expect(404);

    await request(httpServer)
      .get('/rss/2a639777663b4885bc23fd156af05dc')
      .expect(404);

    await request(httpServer)
      .get('/rss/2a639777663b4885bc23fd156af05dc44')
      .expect(404);
  });

  it('Returns 404 when no rows found', async () => {
    await request(httpServer)
      .get(`/rss?mangaId=9999`)
      .expect(404);

    await request(httpServer)
      .get(`/rss?serviceId=9999`)
      .expect(404);
  });

  it('Returns 200 for request without filters', async () => {
    await expectSuccessfulRss(
      request(httpServer)
        .get(`/rss`)
    );
  });

  it('Returns 200 for request with manga filter', async () => {
    await expectSuccessfulRss(
      request(httpServer)
        .get(`/rss?mangaId=1`)
    );
  });

  it('Returns 200 for request with service filter', async () => {
    await expectSuccessfulRss(
      request(httpServer)
        .get(`/rss?serviceId=2`)
    );
  });

  it('Returns 200 for request with service and manga filter', async () => {
    await expectSuccessfulRss(
      request(httpServer)
        .get(`/rss?serviceId=2&mangaId=1`)
    );
  });

  it('Returns 200 for request with user', async () => {
    await expectSuccessfulRss(
      request(httpServer)
        .get(`/rss/${normalUser.userUuid.replace(/-/g, '')}`)
    );
  });
});
