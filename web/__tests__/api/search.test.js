import request from 'supertest';
import { describe, beforeAll, afterAll, it } from 'vitest';

import initServer from '../initServer';
import stopServer from '../stopServer.js';
import { expectErrorMessage } from '../utils';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

afterAll(async () => {
  await stopServer(httpServer);
});

describe('GET /api/quicksearch', () => {
  it('Returns 400 with too small query', async () => {
    await request(httpServer)
      .get('/api/quicksearch')
      .expect(400)
      .expect(expectErrorMessage(undefined, 'query', 'No search query specified'));

    await request(httpServer)
      .get('/api/quicksearch?query=a')
      .expect(400)
      .expect(expectErrorMessage('a', 'query', 'Query must be between 2 and 500 characters'));
  });

  it('Returns 400 with too large query', async () => {
    const query = 'a'.repeat(501);
    await request(httpServer)
      .get(`/api/quicksearch?query=${query}`)
      .expect(400)
      .expect(expectErrorMessage(query, 'query', 'Query must be between 2 and 500 characters'));
  });

  it('Returns 200 with valid query', async () => {
    await request(httpServer)
      .get(`/api/quicksearch?query=test`)
      .expect(200);
  });

  it('Returns 400 with valid query with invalid withServices value', async () => {
    await request(httpServer)
      .get(`/api/quicksearch?query=test&withServices=test`)
      .expect(400);

    await request(httpServer)
      .get(`/api/quicksearch?query=test&withServices=yes`)
      .expect(400);
  });

  it('Returns 200 with valid query and with services', async () => {
    await request(httpServer)
      .get(`/api/quicksearch?query=test&withServices=true`)
      .expect(200);
  });
});


describe('GET /api/search', () => {
  it('Returns 400 with too small query', async () => {
    await request(httpServer)
      .get('/api/search')
      .expect(400)
      .expect(expectErrorMessage(undefined, 'query', 'No search query specified'));

    await request(httpServer)
      .get('/api/search?query=a')
      .expect(400)
      .expect(expectErrorMessage('a', 'query', 'Query must be between 2 and 500 characters'));
  });

  it('Returns 400 with too large query', async () => {
    const query = 'a'.repeat(501);
    await request(httpServer)
      .get(`/api/search?query=${query}`)
      .expect(400)
      .expect(expectErrorMessage(query, 'query', 'Query must be between 2 and 500 characters'));
  });

  it('Returns 200 with valid query', async () => {
    await request(httpServer)
      .get(`/api/search?query=test`)
      .expect(200);
  });
});
