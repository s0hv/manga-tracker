import * as z from 'zod';

export const dbId = z.int().positive();

export const isoDatetimeToDate = z.codec(z.iso.datetime(), z.date(), {
  decode: isoString => new Date(isoString),
  encode: date => date.toISOString(),
});
