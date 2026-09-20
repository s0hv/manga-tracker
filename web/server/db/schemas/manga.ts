import * as z from 'zod';

import { MangaStatus } from '@/types/dbTypes';

import { IntervalValue } from './common';

export const MangaServiceRow = z.strictObject({
  mangaId: z.int(),
  serviceId: z.int(),
  disabled: z.boolean(),
  lastCheck: z.date().nullable(),
  titleId: z.string(),
  nextUpdate: z.date().nullable(),
  latestChapter: z.int().nullable(),
  latestDecimal: z.int().nullable(),
  feedUrl: z.string().nullable(),
});

export type MangaServiceRow = z.infer<typeof MangaServiceRow>;

export const MangaRow = z.strictObject({
  mangaId: z.int(),
  title: z.string(),
  releaseInterval: IntervalValue.nullable(),
  latestRelease: z.date().nullable(),
  estimatedRelease: z.date().nullable(),
  latestChapter: z.int().nullable(),
  views: z.int(),
});

export type MangaRow = z.infer<typeof MangaRow>;

/**
 * Raw shape of `getFullManga`'s result, before the nested `json_build_object`/`array_agg` values
 * (whose keys are unaffected by the shallow top-level camelCase transform) are deep-camelCased.
 */
export const FullMangaRawRow = z.strictObject({
  mangaId: z.int(),
  title: z.string(),
  releaseInterval: IntervalValue.nullable(),
  latestRelease: z.date().nullable(),
  estimatedRelease: z.date().nullable(),
  latestChapter: z.int().nullable(),
  services: z.array(z.strictObject({
    title_id: z.string(),
    service_id: z.int(),
    name: z.string(),
    url_format: z.string(),
    url: z.string(),
  })),
  cover: z.string().nullable(),
  status: z.enum(MangaStatus).nullable(),
  lastUpdated: z.date().nullable(),
  bw: z.string().nullable(),
  mu: z.string().nullable(),
  mal: z.string().nullable(),
  amz: z.string().nullable(),
  ebj: z.string().nullable(),
  engtl: z.string().nullable(),
  raw: z.string().nullable(),
  nu: z.string().nullable(),
  kt: z.string().nullable(),
  ap: z.string().nullable(),
  al: z.string().nullable(),
  aliases: z.array(z.string()).nullable(),
});

export type FullMangaRawRow = z.infer<typeof FullMangaRawRow>;

/**
 * Raw shape of `getFollows`'s result, before the nested `json_agg` values are deep-camelCased.
 */
export const FollowRawRow = z.strictObject({
  title: z.string(),
  cover: z.string().nullable(),
  mangaId: z.int(),
  latestRelease: z.date().nullable(),
  latestChapter: z.int().nullable(),
  services: z.array(z.strictObject({
    service_id: z.int(),
    service_name: z.string(),
    title_id: z.string(),
    url: z.string(),
  })).nullable(),
  followedServices: z.array(z.int().nullable()),
});

export type FollowRawRow = z.infer<typeof FollowRawRow>;

/**
 * Raw shape of `getMangaForElastic`'s result, before the nested `json_build_object`/`array_agg`
 * services are deep-camelCased.
 */
export const MangaForElasticRawRow = z.strictObject({
  mangaId: z.int(),
  title: z.string(),
  views: z.int(),
  aliases: z.array(z.string()).nullable(),
  services: z.array(z.object({
    service_id: z.int(),
    service_name: z.string(),
  })),
});

export type MangaForElasticRawRow = z.infer<typeof MangaForElasticRawRow>;

export const MergeMangaResultRow = z.strictObject({
  aliasCount: z.int(),
  chapterCount: z.int(),
});

export type MergeMangaResultRow = z.infer<typeof MergeMangaResultRow>;
