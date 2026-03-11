import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';


import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  expectErrorMessage,
  normalUser,
  withUser,
} from '../utils';
import { csrfMissing } from '@/serverUtils/constants';

let httpServer: any;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

afterAll(async () => {
  await stopServer(httpServer);
});

describe('POST /api/settings/theme', () => {
  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post('/api/settings/theme?value=light')
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('Returns 400 with invalid theme', async () => {
    const errorMessage = 'Invalid option: expected one of "system"|"light"|"dark"';

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/settings/theme?value=1')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('value', errorMessage));

      await request(httpServer)
        .post('/api/settings/theme?value=DARK')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('value', errorMessage));

      await request(httpServer)
        .post('/api/settings/theme?value=darkk')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('value', errorMessage));
    });
  });

  it('Returns 200 with valid theme and user', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/settings/theme?value=light')
        .csrf()
        .expect(200);
    });
  });

  it('Returns 401 without logging in', async () => {
    await request(httpServer)
      .post('/api/settings/theme?value=dark')
      .csrf()
      .expect(401);
  });
});
