import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import initServer from '../initServer';
import stopServer from '../stopServer';
import { configureJestOpenAPI } from '../utils';


let httpServer: any;

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
