const db = require('..');

const scheduleMangaRun = (mangaId, serviceId, userId) => {
  const sql = 'INSERT INTO scheduled_runs (manga_id, service_id, created_by) VALUES ($1, $2, $3) RETURNING *';
  return db.query(sql, [mangaId, serviceId, userId]);
};

const getScheduledRuns = (mangaId) => {
  const sql = 'SELECT * FROM scheduled_runs WHERE manga_id=$1';
  return db.query(sql, [mangaId]);
};

const deleteScheduledRun = (mangaId, serviceId) => {
  const sql = 'DELETE FROM scheduled_runs WHERE manga_id=$1 AND service_id=$2';
  return db.query(sql, [mangaId, serviceId]);
};

module.exports = {
  scheduleMangaRun,
  getScheduledRuns,
  deleteScheduledRun,
};
