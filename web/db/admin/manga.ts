import snakecaseKeys from 'snakecase-keys';
import { db } from '..';
import type { DatabaseId, MangaId, MangaInfoUpdate } from '@/types/dbTypes';
import type { MangaService, MangaServiceUpdateData } from '@/types/api/manga';
import { generateUpdate } from '../utils';
import { NoColumnsError } from '../errors';
import { BadRequest } from '../../utils/errors';

export const updateMangaTitle = (mangaId: MangaId, newTitle: string) => {
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

export const getMangaServices = (mangaId: MangaId): Promise<MangaService[]> => {
  const sql = `SELECT * FROM manga_service WHERE manga_id=$1`;

  return db.manyOrNone<MangaService>(sql, [mangaId]);
};


export const updateMangaService = async (
  mangaId: MangaId, serviceId: DatabaseId,
  { disabled, nextUpdate }: MangaServiceUpdateData
) => {
  let update: string;
  try {
    update = generateUpdate(snakecaseKeys({ disabled, nextUpdate }), 'manga_service');
  } catch (e) {
    if (e instanceof NoColumnsError) {
      throw new BadRequest('No valid columns given to update');
    }

    throw e;
  }
  const sql = `${update} WHERE manga_id=$1 AND service_id=$2`;

  return db.result(sql, [mangaId, serviceId]);
};
