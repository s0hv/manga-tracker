import { db } from './helpers';
import type { DatabaseId, MangaId } from '@/types/dbTypes';

export function getLatestReleases(serviceId?: DatabaseId, mangaId?: MangaId, userUUID?: string) {
  const joins = [];
  const where = [];
  if (userUUID) {
    joins.push(db.sql`INNER JOIN user_follows uf ON c.manga_id = uf.manga_id AND (uf.service_id IS NULL OR c.service_id=uf.service_id) 
                    INNER JOIN users u ON u.user_id=uf.user_id`);
    where.push(db.sql`u.user_uuid=${userUUID}::uuid`);
  }

  if (mangaId) {
    where.push(db.sql`c.manga_id=${mangaId}`);
  }

  if (serviceId) {
    where.push(db.sql`c.service_id=${serviceId}`);
  }

  return db.any`
        WITH chapters_filtered AS (
            SELECT chapter_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, c.service_id, c.manga_id, g.name as "group"
            FROM chapters as c
            INNER JOIN groups g ON g.group_id = c.group_id 
            ${joins.reduce((acc, join) => db.sql`${acc} ${join}`, db.sql``)}
            ${where.length > 0 ? db.sql`WHERE ${where.reduce((acc, condition) => db.sql`${acc} AND ${condition}`)}` : db.sql``}
        )
        SELECT 
               c.chapter_id,
               m.title as manga_title,
               m.manga_id,
               ms.title_id,
               m.release_interval,
               c.title,
               c.chapter_number,
               c.chapter_decimal,
               c.release_date,
               c.chapter_identifier,
               s.service_name,
               s.chapter_url_format,
               s.url,
               c."group",
               mi.cover
        FROM chapters_filtered c 
            INNER JOIN manga m on c.manga_id = m.manga_id
            INNER JOIN manga_service ms on c.manga_id = ms.manga_id AND ms.service_id = c.service_id
            INNER JOIN services s on c.service_id = s.service_id
            LEFT JOIN manga_info mi ON m.manga_id = mi.manga_id
        WHERE c.release_date > NOW() - INTERVAL '1 hour'
        UNION 
              (SELECT 
                      c.chapter_id,
                      m.title as manga_title,
                      m.manga_id,
                      ms.title_id,
                      m.release_interval,
                      c.title,
                      c.chapter_number,
                      c.chapter_decimal,
                      c.release_date,
                      c.chapter_identifier,
                      s.service_name,
                      s.chapter_url_format,
                      s.url,
                      c."group",
                      mi.cover
              FROM chapters_filtered c
                  INNER JOIN manga m on c.manga_id = m.manga_id
                  INNER JOIN manga_service ms on c.manga_id = ms.manga_id AND ms.service_id = c.service_id
                  INNER JOIN services s on c.service_id = s.service_id
                  LEFT JOIN manga_info mi ON m.manga_id = mi.manga_id
              ORDER BY release_date DESC, chapter_number DESC
              LIMIT 30)
        ORDER BY release_date DESC, chapter_number DESC`;
}

export function getUserFollows(userId: DatabaseId, mangaId: MangaId) {
  return db.any<{ serviceId: number }>`SELECT service_id FROM user_follows WHERE user_id=${userId} AND manga_id=${mangaId}`;
}
