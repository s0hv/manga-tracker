import * as z from 'zod';

export const SessionData = z.object({
  mangaViews: z.record(z.string(), z.number()).optional(),
}).nullable();

export const SessionRow = z.strictObject({
  sessionId: z.string(),
  sessionSecret: z.instanceof(Uint8Array),
  userId: z.int().nullable(),
  expiresAt: z.date(),
  data: SessionData,
});

export type SessionRow = z.infer<typeof SessionRow>;

export const SafeSessionRow = SessionRow.omit({ sessionSecret: true });

export type SafeSessionRow = z.infer<typeof SafeSessionRow>;

export const ClearedSessionRow = z.strictObject({
  sessionId: z.string(),
  data: SessionData,
});

export type ClearedSessionRow = z.infer<typeof ClearedSessionRow>;
