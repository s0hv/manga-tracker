import type { DatabaseId, MangaId } from '@/types/dbTypes';

export type NotificationFieldData = {
  name: string
  value: string
}

export type NotificationManga = {
  mangaId: MangaId
  serviceId?: DatabaseId | null
}


export type NotificationField = NotificationFieldData & {
  optional: boolean,
}

export type NotificationData = {
  notificationId: number,
  useFollows: boolean | null,
  notificationType: number,
  timesRun: number | null,
  timesFailed: number | null,
  disabled: boolean,
  groupByManga: boolean,
  destination: string,
  name: string,
  manga: NotificationManga[] | null,
  fields: NotificationField[]
  overrides: {
    [mangaId: number | string]: NotificationField[]
  }
}

export type NotificationFollow = {
  mangaId: number,
  serviceId: number | null,
  title: string,
  serviceName: string
}
