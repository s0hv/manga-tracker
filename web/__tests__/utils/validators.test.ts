import type { Server } from 'http';

import express from 'express';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from 'vitest';
import z from 'zod';

import { getIncrementalStringGenerator } from '@/tests/utils';
import { validateRequest } from '@/serverUtils/validators';

const app = express();
app.use(express.json());

let httpServer: Server;

beforeAll(() => {
  httpServer = app.listen();
});

afterAll(() => {
  httpServer.close();
});

const endpointGeneratorBase = getIncrementalStringGenerator('testEndpoint');
const endpointGenerator = () => `/${endpointGeneratorBase()}`;

describe('validateRequest works correctly', () => {
  it('body, query and params assertions can be used at the same time', async () => {
    expect.assertions(3);

    const BodySchema = z.object({
      body: z.string(),
    }).strict();
    type BodySchema = z.infer<typeof BodySchema>;

    const QuerySchema = z.object({
      query: z.coerce.number(),
    }).strict();
    type QuerySchema = z.infer<typeof QuerySchema>;

    const PathParamsSchema = z.object({
      params: z.coerce.date(),
    });
    type PathParamsSchema = z.infer<typeof PathParamsSchema>;

    const endpoint = '/combined/:params';
    const now = new Date();

    app.post(endpoint,
      validateRequest({
        body: BodySchema,
        params: PathParamsSchema,
        query: QuerySchema,
      }),
      (req, res) => {
        expectTypeOf(req.body).toEqualTypeOf<BodySchema>();
        expectTypeOf(req.params).toEqualTypeOf<PathParamsSchema>();
        expectTypeOf(req.query).toEqualTypeOf<QuerySchema>();

        expect(req.body.body).toStrictEqual('test');
        expect(req.params.params).toEqual(now);
        expect(req.query.query).toBe(25);

        res.status(200).end();
      });

    await request(httpServer)
      .post(`/combined/${encodeURIComponent(now.toISOString())}`)
      .send({ body: 'test' })
      .query({ query: 25 })
      .expect(200);
  });

  describe('Validating body works correctly', () => {
    it('Replaces the body with the parsed one', async () => {
      expect.assertions(6);

      const Schema = z.object({
        string: z.string(),
        date: z.coerce.date(),
        int: z.coerce.number(),
      });

      const body = {
        string: 'test',
        date: new Date().toISOString(),
        int: '1',
      };

      const schemaEndpoint = endpointGenerator();
      const noSchemaEndpoint = endpointGenerator();

      app.post(schemaEndpoint, validateRequest({ body: Schema }), (req, res) => {
        expectTypeOf(req.params).toEqualTypeOf<unknown>();
        expectTypeOf(req.query).toEqualTypeOf<unknown>();
        expectTypeOf(req.body).toEqualTypeOf<z.infer<typeof Schema>>();

        expect(req.body.string).toStrictEqual(body.string);
        expect(req.body.date).toBeDate();
        expect(req.body.int).toBeNumber();

        res.status(200).end();
      });

      app.post(noSchemaEndpoint, (req, res) => {
        expect(req.body.string).toStrictEqual(body.string);
        expect(req.body.date).not.toBeDate();
        expect(req.body.int).not.toBeNumber();

        res.status(200).end();
      });

      await request(httpServer)
        .post(schemaEndpoint)
        .send(body)
        .expect(200);

      await request(httpServer)
        .post(noSchemaEndpoint)
        .send(body)
        .expect(200);
    });

    it('Rejects extra properties with strict schema', async () => {
      expect.assertions(2);

      const Schema = z.object({
        test: z.string(),
      }).strict();
      type Schema = z.infer<typeof Schema>;

      const body: Schema = { test: 'test' };

      const endpoint = endpointGenerator();

      app.post(endpoint, validateRequest({ body: Schema }), (req, res) => {
        expect(req.body.test).toStrictEqual(body.test);
        res.status(200).end();
      });

      await request(httpServer)
        .post(endpoint)
        .send(body)
        .expect(200);

      await request(httpServer)
        .post(endpoint)
        .send({
          ...body,
          extra: 'extra',
        })
        .expect(400)
        .expect(res => expect(res.body).toMatchInlineSnapshot(`
        {
          "error": {
            "body": [
              "Unrecognized key: "extra"",
            ],
          },
        }
      `));
    });
  });

  describe('Validating path params works correctly', () => {
    it('Replaces the params with the parsed one', async () => {
      expect.assertions(6);

      const Schema = z.object({
        string: z.string(),
        date: z.coerce.date(),
        int: z.coerce.number(),
      });

      const body = {
        string: 'test',
        date: new Date().toISOString(),
        int: '1',
      };

      const schemaEndpoint = `/schemaTest/:string/:date/:int`;
      const noSchemaEndpoint = `/noSchemaTest/:string/:date/:int`;

      app.get(schemaEndpoint, validateRequest({ params: Schema }), (req, res) => {
        expectTypeOf(req.body).toEqualTypeOf<unknown>();
        expectTypeOf(req.query).toEqualTypeOf<unknown>();
        expectTypeOf(req.params).toEqualTypeOf<z.infer<typeof Schema>>();

        expect(req.params.string).toStrictEqual(body.string);
        expect(req.params.date).toBeDate();
        expect(req.params.int).toBeNumber();

        res.status(200).end();
      });

      app.get(noSchemaEndpoint, (req, res) => {
        expect(req.params.string).toStrictEqual(body.string);
        expect(req.params.date).not.toBeDate();
        expect(req.params.int).not.toBeNumber();

        res.status(200).end();
      });

      await request(httpServer)
        .get(`/schemaTest/${body.string}/${encodeURIComponent(body.date)}/${body.int}`)
        .send(body)
        .expect(200);

      await request(httpServer)
        .get(`/noSchemaTest/${body.string}/${encodeURIComponent(body.date)}/${body.int}`)
        .send(body)
        .expect(200);
    });

    it('Shows errors correctly', async () => {
      expect.assertions(3);

      const Schema = z.object({
        test: z.string(),
        int: z.coerce.number(),
      });

      const params = {
        test: 'test',
        int: 1,
      };

      const endpoint = '/errorParams/:test/:int';

      app.get(endpoint, validateRequest({ params: Schema }), (req, res) => {
        expect(req.params.test).toStrictEqual(params.test);
        expect(req.params.int).toBe(params.int);
        res.status(200).end();
      });

      await request(httpServer)
        .get(`/errorParams/${params.test}/${params.int}`)
        .expect(200);

      await request(httpServer)
        .get('/errorParams/1/test')
        .expect(400)
        .expect(res => expect(res.body).toMatchInlineSnapshot(`
          {
            "error": {
              "params.int": [
                "Invalid input: expected number, received NaN",
              ],
            },
          }
        `));
    });
  });

  describe('Validating query works correctly', () => {
    it('Replaces the query with the parsed one', async () => {
      expect.assertions(6);

      const Schema = z.object({
        string: z.string(),
        bool: z.coerce.boolean(),
        int: z.coerce.number(),
      });
      type Schema = z.infer<typeof Schema>;

      const query = {
        string: 'test',
        bool: true,
        int: 1,
      };

      const endpoint = endpointGenerator();
      const noValidateEndpoint = endpointGenerator();

      app.get(endpoint, validateRequest({ query: Schema }), (req, res) => {
        expectTypeOf(req.query).toEqualTypeOf<Schema>();
        expectTypeOf(req.body).toEqualTypeOf<unknown>();
        expectTypeOf(req.params).toEqualTypeOf<unknown>();

        expect(req.query.string).toStrictEqual(query.string);
        expect(req.query.int).toBe(query.int);
        expect(req.query.bool).toStrictEqual(query.bool);

        res.status(200).end();
      });

      app.get(noValidateEndpoint, (req, res) => {
        expectTypeOf(req.query).not.toEqualTypeOf<Schema>();
        expect(req.query.string).toStrictEqual(query.string);
        expect(req.query.int).not.toBe(query.int);
        expect(req.query.bool).not.toBe(query.bool);

        res.status(200).end();
      });

      await request(httpServer)
        .get(endpoint)
        .query(query)
        .expect(res => res)
        .expect(200);

      await request(httpServer)
        .get(noValidateEndpoint)
        .query(query)
        .expect(200);
    });

    it('Shows errors correctly', async () => {
      expect.assertions(3);

      const Schema = z.object({
        test: z.string(),
        int: z.coerce.number(),
      }).strict();

      const query = {
        test: 'test',
        int: 1,
      };

      const endpoint = endpointGenerator();

      app.get(endpoint, validateRequest({ query: Schema }), (req, res) => {
        expect(req.query.test).toStrictEqual(query.test);
        expect(req.query.int).toBe(query.int);
        res.status(200).end();
      });

      await request(httpServer)
        .get(endpoint)
        .query(query)
        .expect(200);

      await request(httpServer)
        .get(endpoint)
        .query({
          test: 'test',
          int: 'test',
          abc: 1,
        })
        .expect(400)
        .expect(res => expect(res.body).toMatchInlineSnapshot(`
        {
          "error": {
            "query": [
              "Unrecognized key: "abc"",
            ],
            "query.int": [
              "Invalid input: expected number, received NaN",
            ],
          },
        }
      `));
    });
  });
});
