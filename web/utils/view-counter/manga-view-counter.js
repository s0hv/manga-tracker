import { query } from '../../db';

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

  // List of args [$1, $2, $3, ...]
  const args = [];
  for (let i=1; i <= Object.keys(session.mangaViews).length; i++) {
    args.push(`$${i}`);
  }

  // Increment views for each manga that was found by one
  const sql = `UPDATE manga SET views=views+1 WHERE manga_id IN (${args.join(',')})`;
  return query(sql, Object.keys(session.mangaViews));
};

