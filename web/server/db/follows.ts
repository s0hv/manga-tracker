import type { DatabaseId, MangaId } from '@/types/dbTypes';

import { db, sql, voidSql } from '.';

import { insertValues } from './utils';

export const insertFollow = (userId: DatabaseId, mangaId: MangaId, serviceId: DatabaseId | null) => {
  return db.query(voidSql`
    INSERT INTO user_follows ${insertValues({ userId, mangaId, serviceId })}
    ON CONFLICT DO NOTHING`);
};

export const deleteFollow = (userId: DatabaseId, mangaId: MangaId, serviceId: DatabaseId | null) => {
  return db.query(voidSql`
      DELETE
      FROM user_follows
      WHERE user_id = ${userId}
        AND manga_id = ${mangaId}
        AND ${serviceId ? sql.fragment`service_id=${serviceId}` : sql.fragment`service_id IS NULL`}`);
};
