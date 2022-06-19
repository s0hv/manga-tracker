import { db } from '..';

export const scheduleMangaRun = (mangaId, serviceId, userId) => {
  const sql = 'INSERT INTO scheduled_runs (manga_id, service_id, created_by) VALUES ($1, $2, $3) RETURNING *';
  return db.one(sql, [mangaId, serviceId, userId]);
};

export const getScheduledRuns = (mangaId) => {
  const sql = 'SELECT * FROM scheduled_runs WHERE manga_id=$1';
  return db.query(sql, [mangaId]);
};

export const deleteScheduledRun = (mangaId, serviceId) => {
  const sql = 'DELETE FROM scheduled_runs WHERE manga_id=$1 AND service_id=$2';
  return db.result(sql, [mangaId, serviceId]);
};
