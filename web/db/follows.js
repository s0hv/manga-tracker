import { db } from './index.js';

export const insertFollow = (userId, mangaId, serviceId) => {
  const sql = 'INSERT INTO user_follows (manga_id, service_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING';
  return db.query(sql, [mangaId, serviceId, userId]);
};

export const deleteFollow = (userId, mangaId, serviceId) => {
  const args = [userId, mangaId];
  let service = 'service_id IS NULL';
  if (serviceId) {
    args.push(serviceId);
    service = 'service_id = $3';
  }

  const sql = `DELETE FROM user_follows WHERE user_id=$1 AND manga_id=$2 AND ${service}`;
  return db.result(sql, args);
};
