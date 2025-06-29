import { faker } from '@faker-js/faker';
import type { JSONSchema4 } from 'json-schema';
import { type Schema, JSONSchemaFaker as jsf } from 'json-schema-faker';
import Random from 'random-seed';


const positiveInteger: JSONSchema4 = {
  type: 'integer',
  minimum: 0,
  exclusiveMinimum: true,
};

const stringType: JSONSchema4 = {
  type: 'string',
};

const urlType: JSONSchema4 = {
  type: 'string',
  faker: 'internet.url',
};

const booleanType: JSONSchema4 = {
  type: 'boolean',
};

const datetimeType: JSONSchema4 = {
  type: 'string',
  format: 'date-time',
};

const imageType: JSONSchema4 = {
  type: 'string',
  faker: 'image.image',
};

export const LatestChapter: JSONSchema4 = {
  type: 'object',
  properties: {
    chapterId: positiveInteger,
    title: stringType,
    chapterNumber: positiveInteger,
    chapterDecimal: positiveInteger,
    releaseDate: datetimeType,
    group: stringType,
    serviceId: positiveInteger,
    chapterIdentifier: stringType,
    manga: stringType,
    mangaId: positiveInteger,
    cover: imageType,
    titleId: stringType,
  },
  required: [
    'chapterId',
    'title',
    'chapterNumber',
    'releaseDate',
    'group',
    'serviceId',
    'chapterIdentifier',
    'manga',
    'mangaId',
    'titleId',
  ],
};

export const MangaService: JSONSchema4 = {
  type: 'object',
  properties: {
    mangaId: positiveInteger,
    serviceId: positiveInteger,
    titleId: stringType,
    disabled: booleanType,
    lastCheck: datetimeType,
    latestChapter: positiveInteger,
    latestDecimal: positiveInteger,
    nextUpdate: datetimeType,
    feedUrl: urlType,
  },
  required: [
    'mangaId',
    'serviceId',
    'titleId',
    'disabled',
  ],
};

export const Service: JSONSchema4 = {
  type: 'object',
  properties: {
    serviceId: positiveInteger,
    name: stringType,
    disabled: booleanType,
    url: urlType,
    chapterUrlFormat: {
      type: 'string',
      format: 'formattedUrl',
    },
    mangaUrlFormat: {
      type: 'string',
      format: 'formattedUrl',
    },
  },
  required: [
    'serviceId',
    'name',
    'disabled',
    'url',
    'chapterUrlFormat',
    'mangaUrlFormat',
  ],
};

export const setupFaker = (seed = 1) => {
  faker.seed(seed);

  const gen = Random.create(seed.toString());
  jsf.extend('faker', () => faker);
  jsf.option('random', () => gen.random());
  jsf.format('formattedUrl', () => {
    let url = faker.internet.url() + '/{}';
    if (jsf.random.pick([true, false])) {
      url += '/{title_id}';
    }

    return url;
  });
};

export const generateNSchemas = <T = ReturnType<typeof jsf.generate>>(schema: Schema, count: number): T[] => {
  const arr: T[] = [];
  for (let i = 0; i < count; i++) {
    arr.push(jsf.generate(schema) as T);
  }

  return arr;
};
