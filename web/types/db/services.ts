import type { PostgresInterval } from '@/types/dbTypes';

export type Service = {
  serviceId: number
  serviceName: string
  url: string
  disabled: boolean
  lastCheck: Date | null
  chapterUrlFormat: string
  disabledUntil: Date | null
  mangaUrlFormat: string
  scheduledRunsDisabledUntil: Date | null
}

export type ServiceWhole = {
  serviceId: number
  feedUrl: string
  lastCheck: Date | null
  nextUpdate: Date | null
  lastId: string | null
}

export type ServiceConfig = {
  serviceId: number
  checkInterval: PostgresInterval
  scheduledRunLimit: number
  scheduledRunsEnabled: boolean
  scheduledRunInterval: PostgresInterval
}
