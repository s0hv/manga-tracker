import type { QueryResult } from 'slonik';

import { db, sql, voidSql } from '#server/db/index';
import type { SafeSession } from '@/types/session';


export const addMangaView = (session: Pick<SafeSession, 'data'> | null, mangaIdStr: string): boolean => {
  if (!session) {
    return false;
  }

  const mangaId = Number.parseInt(mangaIdStr);

  if (!Number.isFinite(mangaId) || mangaId <= 0) {
    return false;
  }

  if (!session.data) {
    session.data = {};
  }

  if (!session.data.mangaViews) {
    session.data.mangaViews = {};
  }

  // Increment manga views for session
  session.data.mangaViews[mangaId] = (session.data.mangaViews[mangaId] ?? 0) + 1;

  return true;
};

/**
 * Reads manga views from session and adds them to the database
 */
export const onSessionExpire = (session: Pick<SafeSession, 'data'> | null): Promise<QueryResult<unknown>> | Promise<void> => {
  const mangaViews = session?.data?.mangaViews;
  if (!session || !mangaViews || Object.keys(mangaViews).length === 0) {
    return Promise.resolve();
  }

  // Increment views for each manga that was found by one
  return db.query(voidSql`UPDATE manga SET views=views+1 WHERE manga_id = ANY(${sql.array(Object.keys(mangaViews).map(Number), 'int4')})`);
};
