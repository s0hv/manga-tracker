import type { PendingQuery, Row } from 'postgres';

import { db } from '#server/db/helpers';
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
export const onSessionExpire = (session: Pick<SafeSession, 'data'> | null): PendingQuery<Row[]> | Promise<void> => {
  const mangaViews = session?.data?.mangaViews;
  if (!session || !mangaViews || Object.keys(mangaViews).length === 0) {
    return Promise.resolve();
  }

  // Increment views for each manga that was found by one
  return db.sql`UPDATE manga SET views=views+1 WHERE manga_id IN ${db.sql(Object.keys(mangaViews))}`.execute();
};
