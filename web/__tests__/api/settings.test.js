import request from 'supertest';
import { csrfMissing } from '../../utils/constants';

import initServer from '../initServer';
import stopServer from '../stopServer';
import { expectErrorMessage, normalUser, withUser } from '../utils';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

afterAll(async () => {
  await stopServer(httpServer);
});

describe('POST /api/settings/theme', () => {
  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post('/api/settings/theme?value=1')
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('Returns 400 with invalid theme', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/settings/theme?value=-1')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('-1', 'value'));

      await request(httpServer)
        .post('/api/settings/theme?value=128')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('128', 'value'));

      await request(httpServer)
        .post('/api/settings/theme?value=abc')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('abc', 'value'));
    });
  });

  it('Returns 200 with valid theme and user', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/settings/theme?value=1')
        .csrf()
        .expect(200);
    });
  });

  it('Returns 200 without logging in', async () => {
    await request(httpServer)
      .post('/api/settings/theme?value=1')
      .csrf()
      .expect(200);
  });
});
