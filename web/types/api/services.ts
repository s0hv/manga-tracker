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

export type ServiceForAdmin = {
  id: number,
  serviceName: string
  disabled: boolean
  url: string
  lastCheck?: Date
  nextUpdate?: Date
}
