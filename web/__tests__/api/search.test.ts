import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import initServer from '../initServer';
import stopServer from '../stopServer';
import { expectErrorMessage } from '../utils';
import { fullManga, isoDateTimeRegex } from '@/tests/constants';


let httpServer: any;

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

  it('Returns 400 with valid query with invalid withServices value', async () => {
    await request(httpServer)
      .get(`/api/quicksearch?query=test&withServices=test`)
      .expect(400);

    await request(httpServer)
      .get(`/api/quicksearch?query=test&withServices=yes`)
      .expect(400);
  });

  it('Returns 200 with valid query', async () => {
    await request(httpServer)
      .get(`/api/quicksearch?query=test`)
      .expect(200)
      .expect(res => expect(res.body).toMatchInlineSnapshot(`
        [
          {
            "mangaId": 1,
            "score": 10,
            "title": "Test Manga",
          },
        ]
      `));
  });

  it('Returns 200 with valid query and with services', async () => {
    await request(httpServer)
      .get(`/api/quicksearch?query=test&withServices=true`)
      .expect(200)
      .expect(res => expect(res.body).toMatchInlineSnapshot(`
        [
          {
            "mangaId": 1,
            "score": 10,
            "services": {
              "1": "Test Service",
            },
            "title": "Test Manga",
          },
        ]
      `));
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
    const mangaWithoutAuthors = { ...fullManga.manga };
    delete mangaWithoutAuthors.author;
    delete mangaWithoutAuthors.artist;

    await request(httpServer)
      .get(`/api/search?query=test`)
      .expect(200)
      .expect(res => expect(res.body).toEqual({
        data: {
          ...fullManga,
          aliases: [
            expect.stringMatching(/(Test alias|Dr\. STONE).*?/),
          ],
          manga: {
            ...mangaWithoutAuthors,
            // Alias and title are flipped during tests
            title: expect.stringMatching(/(Test alias|Dr\. STONE).*?/),
            estimatedRelease: expect.stringMatching(isoDateTimeRegex),
            latestRelease: expect.stringMatching(isoDateTimeRegex),
            lastUpdated: expect.stringMatching(isoDateTimeRegex),
            latestChapter: expect.any(Number),
            status: expect.any(Number),
            releaseInterval: expect.objectContaining({
              days: expect.any(Number),
              hours: expect.any(Number),
              minutes: expect.any(Number),
              seconds: expect.any(Number),
            }),
          },
        },
      }));
  });
});
