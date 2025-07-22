import { MangaStatus, PostgresInterval } from '../dbTypes';

export type MangaData = {
  mangaId: number
  title: string
  releaseInterval?: PostgresInterval | null
  latestRelease?: string | null
  estimatedRelease?: string | null
  latestChapter?: number | null
};

export type MangaInfoData = {
  cover?: string | null
  status: MangaStatus
  artist?: string | null
  author?: string | null
  lastUpdated?: string | null
  bw?: string | null
  mu?: string | null
  mal?: string | null
  amz?: string | null
  ebj?: string | null
  engtl?: string | null
  raw?: string | null
  nu?: string | null
  kt?: string | null
  ap?: string | null
  al?: string | null
};

export type MangaServiceData = {
  titleId: string
  serviceId: number
  name: string
  urlFormat: string
  url: string
};

export type FullMangaData = {
  manga: MangaData & MangaInfoData
  aliases?: string[]
  services: MangaServiceData[]
};

export type MangaService = {
  mangaId: number
  serviceId: number
  disabled: boolean
  lastCheck?: Date | null
  titleId: string
  nextUpdate?: Date | null
  latestChapter?: number | null
  latestDecimal?: number | null
  feedUrl?: string | null
};

export type ScheduledRun = {
  serviceId: number
  name: string
};

export type MangaServiceUpdateData = Partial<Pick<
  MangaService,
  | 'disabled'
  | 'nextUpdate'
>>;

export type MangaServiceCreateData = Partial<Pick<
  MangaService,
  | 'titleId'
  | 'feedUrl'
>>;

export type SearchedManga = {
  mangaId: number
  title: string
  score: number
};

export type SearchedMangaWithService = SearchedManga & {
  /** serviceId: serviceName */
  services: Record<number, string>
};

export type MergeMangaResult = {
  aliasCount: number
  chapterCount: number
};
