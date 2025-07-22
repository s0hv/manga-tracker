import snakecaseKeys from 'snakecase-keys';

import client from './index';
import { MangaForElastic } from '../manga';

export const index = process.env.ES_INDEX || 'manga';

type ServiceFields = {
  'services.service_name'?: string[]
  'services.service_id'?: number[]
};

export type MangaSearchResultFields<
  TWithService extends (true | false | boolean),
  // Array type is used to hack TypeScript into working correctly with conditional types
  // https://github.com/microsoft/TypeScript/issues/51822#issuecomment-1344612998
  TReturnType = [TWithService] extends [false] ? Partial<unknown> : ServiceFields> = {
    manga_id: number[]
    title: string[]
  } & TReturnType;

export type MangaSearchResult<TWithService extends boolean> = {
  hits: {
    total: {
      value: number
      relation: string
    }
    max_score: number
    hits: {
      _id: string
      _score: number
      fields: MangaSearchResultFields<TWithService>
    }[]
  }
};

export const mangaSearch = <TWithServices extends boolean>(query: string, count: number, withServices: TWithServices = false as TWithServices) => {
  const fields = ['manga_id', 'title'];
  if (withServices) {
    fields.push('services.service_name');
    fields.push('services.service_id');
  }

  return client.search<MangaSearchResult<TWithServices>>({
    index,
    body: {
      size: count || 5,
      fields,
      _source: false,

      query: {
        function_score: {
          query: {
            dis_max: {
              queries: [
                {
                  multi_match: {
                    query,
                    type: 'most_fields',
                    fields: [
                      'title^3',
                      'title.ngram',
                    ],
                  },
                },
                {
                  multi_match: {
                    query,
                    type: 'most_fields',
                    fields: [
                      'aliases.title^3',
                      'aliases.title.ngram',
                    ],
                  },
                },
              ],
            },
          },
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
