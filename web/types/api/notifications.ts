import type { DatabaseId, MangaId } from '@/types/dbTypes';

export type NotificationField = {
  name: string
  value: string
}

export type NotificationManga = {
  mangaId: MangaId
  serviceId?: DatabaseId | null
}
