import * as z from 'zod';

export const AuthTokenRow = z.strictObject({
  userId: z.int(),
  tokenHash: z.instanceof(Uint8Array),
  lookup: z.string(),
  expiresAt: z.date(),
});

export type AuthTokenRow = z.infer<typeof AuthTokenRow>;
