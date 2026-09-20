import * as z from 'zod';

import { IntervalValue } from './common';

export const LatestReleaseRow = z.strictObject({
  chapterId: z.int(),
  title: z.string(),
  chapterNumber: z.int(),
  chapterDecimal: z.int().nullable(),
  releaseDate: z.date(),
  chapterIdentifier: z.string(),
  group: z.string(),
  serviceName: z.string(),
  chapterUrlFormat: z.string(),
  url: z.string(),
  mangaTitle: z.string(),
  mangaId: z.int(),
  titleId: z.string(),
  releaseInterval: IntervalValue.nullable(),
  cover: z.string().nullable(),
});

export type LatestReleaseRow = z.infer<typeof LatestReleaseRow>;

export const UserFollowRow = z.strictObject({
  serviceId: z.int().nullable(),
});

export type UserFollowRow = z.infer<typeof UserFollowRow>;
