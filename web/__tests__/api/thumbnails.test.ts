import { http } from 'msw';
import { setupServer } from 'msw/node';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import initServer from '../initServer';
import stopServer from '../stopServer';
import { getErrorMessage } from '../utils';

let httpServer: any;

const server = setupServer(
  http.get('https://uploads.mangadex.org/*', () => new Response(
    null,
    {
      status: 304,
      headers: { 'Cache-Control': 'max-age=31536000' },
    }
  ))
);

beforeAll(async () => {
  ({ httpServer } = await initServer());
  server.listen();
});

beforeEach(() => server.resetHandlers());

afterAll(async () => {
  await stopServer(httpServer);
  server.close();
});

const validParams = {
  extension: '.jpg',
  size: '256',
};
type Params = typeof validParams;
const uuid = 'cc533b5e-ee35-4f5d-b664-3bf277b97273';

describe('GET /thumbnails/mangadex/:mangaId/:coverId', () => {
  const getParams = (params: Partial<Omit<Params, 'extension'>>) => new URLSearchParams(params).toString();

  const getUrl = (mangaId: string, coverId: string, params: Partial<Params> = validParams) =>
    `/thumbnails/mangadex/${mangaId}/${coverId}${params.extension}?${getParams({ size: params.size })}`;

  it('Returns 400 with invalid manga ID', async () => {
    await request(httpServer)
      .get(getUrl('test', uuid))
      .expect(400)
      .expect(res => expect(getErrorMessage(res, 'mangaId', 'params')).toMatchInlineSnapshot(`"Invalid UUID"`));
  });

  it('Returns 400 with invalid cover ID', async () => {
    await request(httpServer)
      .get(getUrl(uuid, 'test'))
      .expect(400)
      .expect(res => expect(getErrorMessage(res, 'coverId', 'params')).toMatchInlineSnapshot(`"Invalid UUID"`));
  });

  it('Returns 400 with invalid extension', async () => {
    await request(httpServer)
      .get(getUrl(uuid, uuid, { ...validParams, extension: 'jpg' }))
      .expect(400)
      .expect(res => expect(getErrorMessage(res, 'extension', 'params')).toMatchInlineSnapshot(`"Invalid input: expected string, received undefined"`));

    await request(httpServer)
      .get(getUrl(uuid, uuid, { ...validParams, extension: '.jpeg' }))
      .expect(400)
      .expect(res => expect(getErrorMessage(res, 'extension', 'params')).toMatchInlineSnapshot(`"Too big: expected string to have <=3 characters"`));
  });

  it('Returns 400 with invalid size', async () => {
    await request(httpServer)
      .get(getUrl(uuid, uuid, { ...validParams, size: '' }))
      .expect(400)
      .expect(res => expect(getErrorMessage(res, 'size', 'params')).toMatchInlineSnapshot(`"Invalid option: expected one of "256"|"512""`));

    await request(httpServer)
      .get(getUrl(uuid, uuid, { ...validParams, size: '1024' }))
      .expect(400)
      .expect(res => expect(getErrorMessage(res, 'size', 'params')).toMatchInlineSnapshot(`"Invalid option: expected one of "256"|"512""`));
  });

  it('allows omitting size', async () => {
    await request(httpServer)
      .get(`/thumbnails/mangadex/${uuid}/${uuid}.jpg`)
      .expect(304)
      .expect(res => {
        expect(res.body).toBeEmptyObject();
        expect(res.headers['cache-control']).toEqual('max-age=31536000');
      });
  });

  it('returns 500 when mangadex returns an error', async () => {
    server.use(
      http.get('https://uploads.mangadex.org/*', () => new Response(null, { status: 400 }))
    );

    await request(httpServer)
      .get(`/thumbnails/mangadex/${uuid}/${uuid}.jpg`)
      .expect(500)
      .expect(res => expect(res.body).toBeEmptyObject());
  });
});
