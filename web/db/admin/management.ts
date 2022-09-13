import { db } from '../helpers';
import type { DatabaseId, MangaId } from '@/types/dbTypes';
import type { ScheduledRun } from '@/types/api/manga';

export const scheduleMangaRun = (mangaId: MangaId, serviceId: DatabaseId, userId: DatabaseId) => {
  return db.one`INSERT INTO scheduled_runs (manga_id, service_id, created_by) 
                VALUES (${mangaId}, ${serviceId}, ${userId}) RETURNING *`;
};

export const getScheduledRuns = (mangaId: MangaId) => {
  return db.any<ScheduledRun>`SELECT * FROM scheduled_runs WHERE manga_id=${mangaId}`;
};

export const deleteScheduledRun = (mangaId: MangaId, serviceId: DatabaseId) => {
  return db.sql`DELETE FROM scheduled_runs WHERE manga_id=${mangaId} AND service_id=${serviceId}`.execute();
};
