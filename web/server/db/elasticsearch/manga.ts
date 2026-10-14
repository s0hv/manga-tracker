import snakecaseKeys from 'snakecase-keys';

import client from './index';
import { MangaForElastic } from '../manga';

export const index = process.env.ES_INDEX ?? 'manga';

type ServiceFields = {
  'services.service_name'?: string[];
  'services.service_id'?: number[];
};

export type MangaSearchResultFields<
  TWithService extends boolean,
  // Array type is used to hack TypeScript into working correctly with conditional types
  // https://github.com/microsoft/TypeScript/issues/51822#issuecomment-1344612998
  TReturnType = [TWithService] extends [false] ? { manga_id: number[] } : ServiceFields
> = {
  manga_id: number[];
  title: string[];
} & TReturnType;

export type MangaSearchResult<TWithService extends boolean> = {
  hits: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number;
    hits: {
      _id: string;
      _score: number;
      fields: MangaSearchResultFields<TWithService>;
    }[];
  };
};

// For queries of more than 3 trigrams, half of them must match. A single typo breaks up to 3 trigrams.
const NGRAM_MINIMUM_SHOULD_MATCH = '3<50%';

const getQueryForField = (query: string, field: string) => ({
  bool: {
    should: [
      {
        match_bool_prefix: {
          [field]: {
            query,
            operator: 'and',
            fuzziness: 'AUTO',
            boost: 3,
          },
        },
      },
      {
        match: {
          [`${field}.ngram`]: {
            query,
            minimum_should_match: NGRAM_MINIMUM_SHOULD_MATCH,
          },
        },
      },
    ],
    minimum_should_match: 1,
  },
});

const getQueriesForFields = (query: string, ...fields: [string, ...string[]]) => {
  return fields.map(field => getQueryForField(query, field));
};

export const mangaSearch = <TWithServices extends boolean = false>(
  query: string,
  count: number,
  withServices: TWithServices = false as TWithServices,
  serviceId?: number
) => {
  const fields = ['manga_id', 'title'];
  if (withServices) {
    fields.push('services.service_name');
    fields.push('services.service_id');
  }

  const dis_max = {
    queries: getQueriesForFields(query, 'title', 'aliases.title'),
  };

  const queryDefinition = serviceId !== undefined
    ? {
      bool: {
        filter: { term: { 'services.service_id': serviceId }},
        must: {
          dis_max,
        },
      },
    }
    : { dis_max };

  return client.search<MangaSearchResult<TWithServices>>({
    index,
    body: {
      size: count || 5,
      fields,
      _source: false,

      query: {
        function_score: {
          query: queryDefinition,
          field_value_factor: {
            field: 'views',
            factor: 0.2,
            modifier: 'log2p',
          },
        },
      },
    },
  });
};

export const updateManga = (id: number | string, data: MangaForElastic) => {
  return client.update({
    index,
    id: id.toString(),
    body: {
      doc: snakecaseKeys(data),
    },
  });
};

export const deleteManga = (id: number | string) => {
  return client.delete({
    index,
    id: id.toString(),
  });
};
