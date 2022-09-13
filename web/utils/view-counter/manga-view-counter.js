import { db } from '../../db/helpers';

export const mangaView = (session, params) => {
  if (!session) {
    return;
  }

  if (!session.mangaViews) {
    session.mangaViews = {};
  }

  const mangaId = params.mangaId;
  if (!mangaId) {
    return;
  }

  // Increment manga views for session
  session.mangaViews[mangaId] = (session.mangaViews[mangaId] || 0) + 1;
};

/**
 * Reads manga views from session and adds them to the database
 * @returns {Promise}
 */
export const onSessionExpire = (session) => {
  if (!session || !session.mangaViews || Object.keys(session.mangaViews).length === 0) {
    return Promise.resolve();
  }

  // Increment views for each manga that was found by one
  return db.sql`UPDATE manga SET views=views+1 WHERE manga_id IN ${db.sql(Object.keys(session.mangaViews))}`.execute();
};

