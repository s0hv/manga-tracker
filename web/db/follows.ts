import { db } from './helpers';
import type { DatabaseId, MangaId } from '@/types/dbTypes';

export const insertFollow = (userId: DatabaseId, mangaId: MangaId, serviceId: DatabaseId) => {
  return db.sql`INSERT INTO user_follows ${db.sql({ userId, mangaId, serviceId })} ON CONFLICT DO NOTHING`
    .execute();
};

export const deleteFollow = (userId: DatabaseId, mangaId: MangaId, serviceId: DatabaseId) => {
  return db.sql`DELETE FROM user_follows 
       WHERE user_id=${userId} AND manga_id=${mangaId} AND ${serviceId ? db.sql`service_id=${serviceId}` : db.sql`service_id IS NULL`}`
    .execute();
};
