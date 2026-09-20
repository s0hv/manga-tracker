import * as z from 'zod';

import { Theme } from '@/types/dbTypes';

import { SessionData } from './session';

export const UserRow = z.strictObject({
  userId: z.int(),
  username: z.string(),
  email: z.string(),
  userUuid: z.uuidv4(),
  theme: Theme,
  admin: z.boolean(),
  isCredentialsAccount: z.boolean(),
});

export type UserRow = z.infer<typeof UserRow>;

export const AuthUserRow = z.strictObject({
  email: z.string(),
  username: z.string(),
  userUuid: z.uuidv4(),
  userId: z.int(),
  theme: Theme,
  admin: z.boolean(),
});

export type AuthUserRow = z.infer<typeof AuthUserRow>;

// Full user export used by the account data-request endpoint
export const UserDataExportRow = z.strictObject({
  userId: z.int(),
  username: z.string(),
  email: z.string(),
  userUuid: z.uuidv4(),
  joinedAt: z.date(),
  theme: Theme,
  admin: z.boolean(),
  lastActive: z.date().nullable(),
});

export type UserDataExportRow = z.infer<typeof UserDataExportRow>;

export const AccountRow = z.strictObject({
  provider: z.literal('discord'),
  providerAccountId: z.string(),
  userId: z.int(),
});

export type AccountRow = z.infer<typeof AccountRow>;

export const UserFollowExportRow = z.strictObject({
  userId: z.int(),
  mangaId: z.int(),
  serviceId: z.int().nullable(),
  title: z.string(),
  serviceName: z.string(),
});

export type UserFollowExportRow = z.infer<typeof UserFollowExportRow>;

export const UserSessionExportRow = z.strictObject({
  expiresAt: z.date(),
  data: SessionData,
});

export type UserSessionExportRow = z.infer<typeof UserSessionExportRow>;
