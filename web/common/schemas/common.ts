import * as z from 'zod';

import { MangaStatus } from '@/common/mangaStatus';

export const dbId = z.int().positive();

export const isoDatetimeToDate = z.codec(z.iso.datetime(), z.date(), {
  decode: isoString => new Date(isoString),
  encode: date => date.toISOString(),
});

export const MangaStatusSchema = z.enum(MangaStatus);
