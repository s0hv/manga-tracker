import { PostgresInterval } from '../dbTypes';

export type ServiceConfig = {
  serviceId: number,
  checkInterval: PostgresInterval,
  scheduledRunLimit: number,
  scheduledRunsEnabled: boolean,
  scheduledRunInterval: PostgresInterval
}
