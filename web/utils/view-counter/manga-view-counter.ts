import type { AdapterSession } from 'next-auth/adapters';
import type { PendingQuery, Row } from 'postgres';
import { db } from '@/db/helpers';
import type { SessionData } from '@/types/dbTypes';

export const mangaView = (session: Pick<AdapterSession, 'data'> | null, params: Record<string, string>): void => {
  if (!session) {
    return;
  }

  const mangaId = params.mangaId;
  if (!mangaId) {
    return;
  }

  if (!session.data) {
    session.data = {};
  }

  if (!session.data.mangaViews) {
    session.data.mangaViews = {};
  }

  // Increment manga views for session
  session.data.mangaViews[mangaId] = (session.data.mangaViews[mangaId] || 0) + 1;
};

/**
 * Reads manga views from session and adds them to the database
 */
export const onSessionExpire = (session: SessionData | null): PendingQuery<Row[]> | Promise<void> => {
  const mangaViews = session?.mangaViews;
  if (!session || !mangaViews || Object.keys(mangaViews).length === 0) {
    return Promise.resolve();
  }

  // Increment views for each manga that was found by one
  return db.sql`UPDATE manga SET views=views+1 WHERE manga_id IN ${db.sql(Object.keys(mangaViews))}`.execute();
};
