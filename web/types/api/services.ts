import { PostgresInterval } from '../dbTypes';

export type ServiceConfig = {
  serviceId: number
  checkInterval: PostgresInterval
  scheduledRunLimit: number
  scheduledRunsEnabled: boolean
  scheduledRunInterval: PostgresInterval
}

export type ServiceForApi = {
  serviceId: number
  name: string
  disabled: boolean
  url: string
  chapterUrlFormat: string
  mangaUrlFormat: string
}

type ServiceForAdminCommon = {
  id: number,
  serviceName: string
  disabled: boolean
  url: string
}

export type ServiceForAdmin = ServiceForAdminCommon & {
  lastCheck?: Date | null
  nextUpdate?: Date | null
}

export type ServiceForAdminSerialized = ServiceForAdminCommon & {
  lastCheck?: string | null
  nextUpdate?: string | null
}
