import camelcaseKeys from 'camelcase-keys';

import { db } from './helpers';
import { fetchExtraInfo, MANGADEX_ID } from './mangadex.js';
import { HttpError } from '../utils/errors.js';
import { mangadexLogger } from '../utils/logging.js';
import type { DatabaseId, MangaId } from '@/types/dbTypes';
import type { Manga } from '@/types/db/manga';

const links = {
  al: 'https://anilist.co/manga/',
  ap: 'https://www.anime-planet.com/manga/',
  bw: 'https://bookwalker.jp/',
  mu: 'https://www.mangaupdates.com/series.html?id=',
  nu: 'https://www.novelupdates.com/series/',
  kt: 'https://kitsu.io/manga/',
  mal: 'https://myanimelist.net/manga/',
} as const;

export function formatLinks(row: Record<string, string>) {
  if (typeof row !== 'object') return;

  Object.keys(row).forEach(key => {
    const link = links[key as keyof typeof links];
    if (!link || !row[key]) return;

    row[key] = link + row[key];
  });
}

export type FullManga = {
  services?: object[],
  chapters?: object[],
  aliases?: string[]
  manga: object
}

type FullMangaUnformatted = {
  services: any[],
  chapters?: any[],
  aliases: string[],
  [key: string]: any
}

function formatFullManga(obj: Partial<FullMangaUnformatted>): FullManga {
  const out: FullManga = {
    manga: {},
  };

  if (obj.services) {
    out.services = obj.services;
    delete obj.services;
  }

  if (obj.chapters) {
    out.chapters = obj.chapters;
    delete obj.chapters;
  }

  if (obj.aliases) {
    out.aliases = obj.aliases;
    delete obj.aliases;
  }
  out.manga = obj;

  return out;
}

export function getFullManga(mangaId: MangaId): Promise<FullManga | null> {
  return db.oneOrNone<FullMangaUnformatted>`SELECT manga.manga_id, title, release_interval, latest_release, estimated_release, manga.latest_chapter,
                        array_agg(json_build_object('title_id', ms.title_id, 'service_id', ms.service_id, 'name', s.service_name, 'url_format', chapter_url_format, 'url', s.manga_url_format)) as services,
                        mi.cover, mi.status, mi.last_updated,
                        mi.bw, mi.mu, mi.mal, mi.amz, mi.ebj, mi.engtl, mi.raw, mi.nu, mi.kt, mi.ap, mi.al,
                        (SELECT array_agg(title) FROM manga_alias ma WHERE ma.manga_id=${mangaId}) as aliases
               FROM manga LEFT JOIN manga_info mi ON manga.manga_id = mi.manga_id
                   INNER JOIN manga_service ms ON manga.manga_id = ms.manga_id
                   INNER JOIN services s ON ms.service_id = s.service_id
               WHERE manga.manga_id=${mangaId}
               GROUP BY manga.manga_id, mi.manga_id`
    .then(row => {
      if (!row) {
        return null;
      }

      row = camelcaseKeys(row, { deep: true });

      const mdIdx = row.services.findIndex(v => v.serviceId === MANGADEX_ID);
      // If info doesn't exist or 2 weeks since last update
      if ((!row.lastUpdated || (Date.now() - row.lastUpdated)/8.64E7 > 14) && mdIdx >= 0) {
        fetchExtraInfo(row.services[mdIdx].titleId, mangaId)
          .catch(mangadexLogger.error);
      }

      formatLinks(row);
      return formatFullManga(row);
    });
}

export async function getFollows(userId: DatabaseId) {
  if (!userId) {
    throw HttpError(404);
  }

  return db.any`SELECT m.title, mi.cover, m.manga_id, m.latest_release, m.latest_chapter,
                    (SELECT json_agg(s) FROM (
                       SELECT ms.service_id, service_name, ms.title_id, manga_url_format as url
                       FROM services INNER JOIN manga_service ms ON services.service_id = ms.service_id
                       WHERE ms.manga_id=m.manga_id) s) as services,
                    json_agg(uf.service_id) as followed_services
               FROM user_follows uf
                   INNER JOIN manga m ON uf.manga_id = m.manga_id
                   LEFT JOIN manga_info mi ON m.manga_id = mi.manga_id
               WHERE user_id=${userId}
               GROUP BY uf.manga_id, m.manga_id, mi.manga_id`
    .then(rows => camelcaseKeys(rows, { deep: true }))
    .catch(err => {
      // integer overflow
      if (err.code === '22003' || err.code === '22P02') {
        return new Promise((resolve, reject) => reject(HttpError(404, 'Integer out of range')));
      }
      console.error(err);
      return new Promise((resolve, reject) => reject(HttpError(500)));
    });
}

export const getAliases = (mangaId: MangaId) => {
  return db.any<{ title: string }>`SELECT title FROM manga_alias WHERE manga_id=${mangaId}`;
};

// Actually just gets a single row from the manga table
export const getMangaPartial = (mangaId: MangaId) => {
  return db.one<Manga>`SELECT * FROM manga WHERE manga_id=${mangaId}`;
};

export type MangaForElastic = {
  mangaId: number,
  title: string,
  views: number,
  aliases: { title: string }[],
  services: { serviceId: number, serviceName: string }[]
}

export const getMangaForElastic = (mangaId: MangaId): Promise<MangaForElastic> => {
  return db.one<any>`SELECT
      m.manga_id,
      m.title,
      m.views,
      (SELECT array_remove(array_agg(ma.title), NULL) FROM manga_alias ma WHERE ma.manga_id=m.manga_id) as aliases,
      array_agg(json_build_object('service_id', s.service_id, 'service_name', s.service_name)) as services
  FROM manga m
  INNER JOIN manga_service ms ON m.manga_id = ms.manga_id
  INNER JOIN services s ON s.service_id = ms.service_id
  WHERE m.manga_id=${mangaId}
  GROUP BY m.manga_id, ms.manga_id`
    .then(manga => {
      manga.aliases = manga.aliases?.map((title: string) => ({ title })) || [];
      return manga;
    });
};
