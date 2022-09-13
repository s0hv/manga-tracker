export enum Theme {
  Automatic = 0,
  Light = 1,
  Dark = 2
}

export interface SessionUser {
    username: string,
    uuid: string,
    userId: number,
    theme: Theme | null,
    admin: boolean,
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
