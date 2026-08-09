import { faker } from '@faker-js/faker';
import {
  type JsonSchema,
  createGeneratorSync,
} from 'json-schema-faker';

import { DbChapterCreate } from '@/common/schemas/chapter';
import type { ChapterFail } from '@/types/db/chapterFail';

type JsonSchemaObject = Exclude<JsonSchema, boolean>;

const nullable = (schema: JsonSchemaObject): JsonSchema => {
  if (!schema.type) {
    throw new Error('Cannot make a nullable schema without a type');
  }

  return {
    ...schema,
    type: Array.isArray(schema.type)
      ? ['null', ...schema.type]
      : ['null', schema.type],
  };
};

const positiveInteger: JsonSchema = {
  type: 'integer',
  minimum: 0,
  exclusiveMinimum: 1,
};

const serviceIdSchema: JsonSchema = {
  ...positiveInteger,
  // Currently the highest service ID (KManga)
  maximum: 12,
};

const mangaIdSchema: JsonSchema = {
  ...positiveInteger,
  // Test db has 4 test manga
  maximum: 4,
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
    serviceId: serviceIdSchema,
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

export const MangaService = {
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
} as const satisfies JsonSchema;

export const Service = {
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
} as const satisfies JsonSchema;

export const ChapterFailSchema = {
  type: 'object',

  properties: {
    chapterIdentifier: stringType,
    serviceId: serviceIdSchema,
    title: nullable(stringType),
    chapterNumber: nullable(positiveInteger),
    chapterDecimal: nullable(positiveInteger),
    releaseDate: nullable(datetimeType),
    group: nullable(stringType),
    mangaId: nullable(mangaIdSchema),
    errors: stringType,
    titleId: nullable(stringType),
    mangaTitle: nullable(stringType),
  } satisfies Record<keyof Omit<ChapterFail, 'timestamp'>, JsonSchema>,

  required: [
    'chapterIdentifier',
    'serviceId',
    'title',
    'chapterNumber',
    'chapterDecimal',
    'releaseDate',
    'group',
    'mangaId',
    'errors',
    'titleId',
    'mangaTitle',
  ],
} as const satisfies JsonSchema;

export const ChapterCreateSchema = {
  type: 'object',

  properties: {
    title: stringType,
    chapterNumber: positiveInteger,
    chapterDecimal: nullable(positiveInteger),
    releaseDate: datetimeType,
    group: {
      type: 'object',
      properties: {
        name: stringType,
        groupId: { type: 'null' },
      },
      required: ['name', 'groupId'],
    },
    serviceId: serviceIdSchema,
    chapterIdentifier: stringType,
    mangaId: mangaIdSchema,
  } satisfies Record<keyof DbChapterCreate, JsonSchema>,

  required: [
    'title',
    'chapterNumber',
    'chapterDecimal',
    'releaseDate',
    'group',
    'serviceId',
    'chapterIdentifier',
    'mangaId',
  ],
} as const satisfies JsonSchema;

let generator: ReturnType<typeof createGeneratorSync>['generate'];

export const setupFaker = (seed = 1) => {
  faker.seed(seed);

  generator = createGeneratorSync({
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

type SchemaTypeMap<TSchema, TFallback = unknown> =
  TSchema extends typeof ChapterCreateSchema
    ? DbChapterCreate
    : TSchema extends typeof ChapterFailSchema
      ? Omit<ChapterFail, 'timestamp'>
      : TFallback;

export const generateNSchemas = <T = unknown>(schema: JsonSchema, count: number): T[] => {
  const arr: T[] = [];
  for (let i = 0; i < count; i++) {
    arr.push(generator(schema) as T);
  }

  return arr;
};

export const generateSchema = <TSchema extends JsonSchema, T = SchemaTypeMap<TSchema>>(
  schema: TSchema
): SchemaTypeMap<TSchema, T> => generator(schema) as SchemaTypeMap<TSchema, T>;
