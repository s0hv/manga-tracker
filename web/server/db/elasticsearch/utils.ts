import { ApiResponse } from '@elastic/elasticsearch';
import type { Response } from 'express-serve-static-core';

import type {
  MangaSearchResult,
  MangaSearchResultFields,
} from '@/db/elasticsearch/manga';

export const handleElasticError = (err: unknown, res: Response) => {
  const error = 'Internal server error';
  console.error(err);
  res.status(500).json({ error });
};

export type ExtractedFields = {
  score: number
  [key: string]: unknown
};
export type CustomFieldFormatter<T extends boolean> = (fields: MangaSearchResultFields<T>) => Record<string, unknown>;

export const extractFields = <T extends boolean>(
  result: ApiResponse<MangaSearchResult<T>>,
  fields?: (keyof MangaSearchResultFields<T>)[],
  idPrefix?: string,
  customFieldFormatter?: (fields: MangaSearchResultFields<T>) => Record<string, unknown>
) => {
  const mappedIdPrefix = idPrefix ? `${idPrefix}_` : '';
  return result.body.hits.hits.map(hit => {
    const o: ExtractedFields = {
      [`${mappedIdPrefix}id`]: Number(hit._id),
      score: hit._score,
    };
    if (fields) {
      fields.forEach(field => {
        o[field as string] = (hit.fields[field] as Array<unknown> ?? [])[0];
      });

      if (customFieldFormatter) {
        const formatted = customFieldFormatter(hit.fields);
        Object.keys(formatted).forEach(k => {
          o[k] = formatted[k];
        });
      }
    }

    return o;
  });
};
