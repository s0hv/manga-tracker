export type NotificationFieldData = {
  name: string
  value: string
}

export type NotificationFollow = {
  mangaId: number,
  serviceId: number | null,
  title: string,
  serviceName: string
}


export type NotificationManga = NotificationFollow


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
