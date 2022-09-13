import { db } from '../helpers';
import type { DatabaseId, MangaId, MangaInfoUpdate } from '@/types/dbTypes';
import type {
  MangaService,
  MangaServiceCreateData,
  MangaServiceUpdateData,
} from '@/types/api/manga';
import { generateUpdate } from '../utils';

export const updateMangaTitle = (mangaId: MangaId, newTitle: string) => {
  const sql = db.one`UPDATE manga
               SET title=${newTitle}
               WHERE manga_id=${mangaId}
               RETURNING (SELECT title FROM manga WHERE manga_id=${mangaId})`;

  return sql.then(row => db.oneOrNone`
    UPDATE manga_alias
    SET title=${row.title}
    WHERE manga_id=${mangaId} AND title=${newTitle} AND NOT EXISTS(SELECT 1 FROM manga_alias WHERE manga_id=${mangaId} AND title=${row.title})
    RETURNING title`);
};

export const updateMangaInfo = (mangaInfo: MangaInfoUpdate) => {
  return db.sql`UPDATE manga_info SET status=${mangaInfo.status} WHERE manga_id=${mangaInfo.mangaId}`.execute();
};

export const getMangaServices = (mangaId: MangaId): Promise<MangaService[]> => {
  return db.manyOrNone<MangaService>`SELECT * FROM manga_service WHERE manga_id=${mangaId}`;
};


export const updateMangaService = async (
  mangaId: MangaId, serviceId: DatabaseId,
  { disabled, nextUpdate }: MangaServiceUpdateData
) => {
  return db.sql`UPDATE manga_service SET ${generateUpdate({ disabled, nextUpdate }, db.sql)} WHERE manga_id=${mangaId} AND service_id=${serviceId}`.execute();
};

export const createMangaService = (
  mangaId: MangaId, serviceId: DatabaseId,
  { titleId, feedUrl }: MangaServiceCreateData
) => {
  return db.sql`INSERT INTO manga_service (manga_id, service_id, title_id, feed_url) 
                VALUES (${mangaId}, ${serviceId}, ${titleId}, ${feedUrl})`
    .execute();
};
