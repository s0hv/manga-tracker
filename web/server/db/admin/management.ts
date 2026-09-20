import type { DatabaseId, MangaId } from '@/types/dbTypes';

import { db, sql, voidSql } from '../index';
import { ScheduledRunRow } from '../schemas/scheduledRun';

export const scheduleMangaRun = (mangaId: MangaId, serviceId: DatabaseId, userId: DatabaseId) => {
  return db.one(sql.type(ScheduledRunRow)`INSERT INTO scheduled_runs (manga_id, service_id, created_by)
                VALUES (${mangaId}, ${serviceId}, ${userId}) RETURNING *`);
};

export const getScheduledRuns = (mangaId: MangaId) => {
  return db.any(sql.type(ScheduledRunRow)`SELECT * FROM scheduled_runs WHERE manga_id=${mangaId}`);
};

export const deleteScheduledRun = (mangaId: MangaId, serviceId: DatabaseId) => {
  return db.query(voidSql`DELETE FROM scheduled_runs WHERE manga_id=${mangaId} AND service_id=${serviceId}`);
};
