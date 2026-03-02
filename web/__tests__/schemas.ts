import { faker } from '@faker-js/faker';
import { type JsonSchema, createGenerator, generate } from 'json-schema-faker';


const positiveInteger: JsonSchema = {
  type: 'integer',
  minimum: 0,
  exclusiveMinimum: 1,
};

const stringType: JsonSchema = {
  type: 'string',
  minLength: 5,
};

const urlType: JsonSchema = {
  type: 'string',
  faker: 'internet.url',
};

const booleanType: JsonSchema = {
  type: 'boolean',
};

const datetimeType: JsonSchema = {
  type: 'string',
  format: 'date-time',
};

const imageType: JsonSchema = {
  type: 'string',
  format: 'coverUrl',
};

export const LatestChapter: JsonSchema = {
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

export const MangaService: JsonSchema = {
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

export const Service: JsonSchema = {
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

let generator: ReturnType<typeof createGenerator>['generate'];

export const setupFaker = (seed = 1) => {
  faker.seed(seed);

  generator = createGenerator({
    seed,

    extensions: {
      faker,
    },

    formats: {
      formattedUrl: random => {
        let url = faker.internet.url() + '/{}';
        if (random.pick([true, false])) {
          url += '/{title_id}';
        }

        return url;
      },

      coverUrl: () => {
        const url = new URL(faker.image.url());
        url.hostname = 'mangadex.org';

        return url.toString();
      },
    },


  }).generate;
};

export const generateNSchemas = async <T = ReturnType<typeof generate>>(schema: JsonSchema, count: number): Promise<T[]> => {
  const arr: T[] = [];
  for (let i = 0; i < count; i++) {
    arr.push(await generator(schema) as T);
  }

  return arr;
};
