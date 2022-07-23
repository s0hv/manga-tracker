import { db } from '..';
import { MangaInfoUpdate } from '../../types/dbTypes';

export const updateMangaTitle = (mangaId, newTitle) => {
  const sql = `UPDATE manga
               SET title=$1
               WHERE manga_id=$2
               RETURNING (SELECT title FROM manga WHERE manga_id=$2)`;

  const aliasSql = `UPDATE manga_alias
                    SET title=$1
                    WHERE manga_id=$2 AND title=$3 AND NOT EXISTS(SELECT 1 FROM manga_alias WHERE manga_id=$2 AND title=$1)
                    RETURNING title`;

  return db.one(sql, [newTitle, mangaId])
    .then(row => db.oneOrNone(aliasSql, [row.title, mangaId, newTitle]));
};

export const updateMangaInfo = (mangaInfo: MangaInfoUpdate) => {
  const sql = 'UPDATE manga_info SET status=$1 WHERE manga_id=$2';
  return db.result(sql, [mangaInfo.status, mangaInfo.mangaId]);
};
