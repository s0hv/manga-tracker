import faker from '@faker-js/faker';
import jsf from 'json-schema-faker';
import Random from 'random-seed';


const positiveInteger = {
  type: 'integer',
  minimum: 0,
  exclusiveMinimum: true,
};

const stringType = {
  type: 'string',
};

const datetimeType = {
  type: 'string',
  format: 'date-time',
};

const imageType = {
  type: 'string',
  faker: 'image.image',
};

export const LatestChapter = {
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
  ],
};

export const setupFaker = (seed = 1) => {
  faker.seed(seed);

  const gen = new Random(seed);
  jsf.extend('faker', () => faker);
  jsf.option('random', () => gen.random());
};

export const generateNSchemas = (schema, count) => {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push(jsf.generate(schema));
  }

  return arr;
};
