import { MangaStatus, PostgresInterval } from '../dbTypes';

export type MangaData = {
  mangaId: number,
  title: string,
  releaseInterval?: PostgresInterval,
  latestRelease?: string,
  estimatedRelease?: string,
  latestChapter?: number
}

export type MangaInfoData = {
  cover?: string,
  status: MangaStatus,
  lastUpdated?: string,
  bw?: string,
  mu?: string,
  mal?: string,
  amz?: string,
  ebj?: string,
  engtl?: string,
  raw?: string,
  nu?: string,
  kt?: string,
  ap?: string,
  al?: string,
}

export type MangaServiceData = {
  titleId: string,
  serviceId: number,
  name: string,
  urlFormat: string,
  url: string
}

export type FullMangaData = {
  manga: MangaData & MangaInfoData
  aliases: string[],
  services: MangaServiceData[]
}
