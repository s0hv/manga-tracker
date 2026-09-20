import * as z from 'zod';

import type {
  MangaServiceCreateData,
  MangaServiceUpdateData,
} from '@/types/api/manga';
import type { DatabaseId, MangaId, MangaInfoUpdate } from '@/types/dbTypes';

import { db, sql, voidSql } from '../index';
import { MangaServiceRow } from '../schemas/manga';
import { updateSet } from '../utils';

const TitleRow = z.object({ title: z.string() });

export const updateMangaTitle = (mangaId: MangaId, newTitle: string) => {
  const titleQuery = db.one(sql.type(TitleRow)`UPDATE manga
               SET title=${newTitle}
               WHERE manga_id=${mangaId}
               RETURNING (SELECT title FROM manga WHERE manga_id=${mangaId})`);

  return titleQuery.then(row => db.maybeOne(sql.type(TitleRow)`
    UPDATE manga_alias
    SET title=${row.title}
    WHERE manga_id=${mangaId} AND title=${newTitle} AND NOT EXISTS(SELECT 1 FROM manga_alias WHERE manga_id=${mangaId} AND title=${row.title})
    RETURNING title`));
};

export const updateMangaInfo = (mangaInfo: MangaInfoUpdate) => {
  return db.query(voidSql`UPDATE manga_info SET status=${mangaInfo.status} WHERE manga_id=${mangaInfo.mangaId}`);
};

export const getMangaServices = (mangaId: MangaId) => {
  return db.any(sql.type(MangaServiceRow)`SELECT * FROM manga_service WHERE manga_id=${mangaId}`);
};


export const updateMangaService = async (
  mangaId: MangaId, serviceId: DatabaseId,
  { disabled, nextUpdate }: MangaServiceUpdateData
) => {
  return db.query(voidSql`UPDATE manga_service SET ${updateSet({ disabled, nextUpdate })} WHERE manga_id=${mangaId} AND service_id=${serviceId}`);
};

export const createMangaService = (
  mangaId: MangaId, serviceId: DatabaseId,
  { titleId, feedUrl }: MangaServiceCreateData
) => {
  return db.query(voidSql`INSERT INTO manga_service (manga_id, service_id, title_id, feed_url)
                VALUES (${mangaId}, ${serviceId}, ${titleId ?? null}, ${feedUrl ?? null})`);
};
