import request from 'supertest';
import { describe, expect, beforeAll, afterAll, it } from 'vitest';

import initServer from '../initServer';
import { configureJestOpenAPI } from '../utils';
import stopServer from '../stopServer.js';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
  await configureJestOpenAPI();
});

afterAll(async () => {
  await stopServer(httpServer);
});

describe('/api/services', () => {
  it('Should satisfy api spec', async () => {
    await request(httpServer)
      .get(`/api/services`)
      .expect(200)
      .expect(res => {
        expect(res.body).toBeObject();
        expect(res.body.data).toBeArray();
        expect(res.body.data).not.toHaveLength(0);
      })
      .satisfiesApiSpec();
  });
});
