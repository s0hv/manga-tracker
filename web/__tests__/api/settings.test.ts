import request from 'supertest';
import { describe, beforeAll, afterAll, it } from 'vitest';

import { csrfMissing } from '@/serverUtils/constants';

import initServer from '../initServer';
import stopServer from '../stopServer';
import { expectErrorMessage, normalUser, withUser } from '../utils';

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
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/settings/theme?value=1')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('1', 'value'));

      await request(httpServer)
        .post('/api/settings/theme?value=DARK')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('DARK', 'value'));

      await request(httpServer)
        .post('/api/settings/theme?value=darkk')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('darkk', 'value'));
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
