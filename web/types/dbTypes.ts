import type { DefaultUser } from 'next-auth';

export type Theme = 'system' | 'light' | 'dark';

export interface SessionUser extends DefaultUser {
  username: string,
  uuid: string,
  userId: number,
  theme: Theme,
  admin: boolean,
  isCredentialsAccount: boolean,
}

export interface SessionData {
  [k: string]: any
}

/**
 * Subset of the interval object returned by postgres-interval.
 * Only contains time related properties
 */
export interface PostgresInterval {
  years?: number
  months?: number
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
  milliseconds?: number
}

export enum MangaStatus {
    ONGOING = 0,
    COMPLETED = 1,
    DROPPED = 2,
    HIATUS = 3,
}

export enum NotificationType {
  DiscordWebhook = 1,
  GenericWebhook = 2,
}

export type MangaId = number | string;
export type DatabaseId = number | string;

export interface MangaInfoUpdate {
  mangaId: MangaId
  status: MangaStatus
}
