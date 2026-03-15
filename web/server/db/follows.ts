import type { DatabaseId, MangaId } from '@/types/dbTypes';

import { db } from './helpers';

export const insertFollow = (userId: DatabaseId, mangaId: MangaId, serviceId: DatabaseId | null) => {
  return db.any`INSERT INTO user_follows ${db.sql({ userId, mangaId, serviceId })} ON CONFLICT DO NOTHING`;
};

export const deleteFollow = (userId: DatabaseId, mangaId: MangaId, serviceId: DatabaseId | null) => {
  return db.any`DELETE FROM user_follows 
       WHERE user_id=${userId} AND manga_id=${mangaId} AND ${serviceId ? db.sql`service_id=${serviceId}` : db.sql`service_id IS NULL`}`;
};
