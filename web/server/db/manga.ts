import { DatabaseError } from '@slonik/pg-driver';
import camelcaseKeys from 'camelcase-keys';
import { InvalidInputError } from 'slonik';
import * as z from 'zod';

import { NUMERIC_VALUE_OUT_OF_RANGE } from '@/db/errorCodes';
import type {
  FullMangaData,
  MangaInfoData,
  MangaServiceData,
} from '@/types/api/manga';
import type { Follow } from '@/types/db/follows';
import type { DatabaseId, MangaId, PostgresInterval } from '@/types/dbTypes';

import { db, sql } from './index';
import { HttpError } from '../utils/errors';
import { mangadexLogger } from '../utils/logging';

import { fetchExtraInfo, MANGADEX_ID } from './mangadex';
import {
  FollowRawRow,
  FullMangaRawRow,
  MangaForElasticRawRow,
  MangaRow,
} from './schemas/manga';

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

export interface MangaData extends Omit<MangaInfoData, 'lastUpdated'> {
  mangaId: number;
  title: string;
  releaseInterval?: PostgresInterval | null;
  latestRelease?: Date | null;
  estimatedRelease?: Date | null;
  latestChapter?: number | null;
  lastUpdated?: Date | null;
}

interface FullMangaUnformatted extends MangaData {
  services: MangaServiceData[];
  aliases: string[];
}

function formatFullManga(obj: Partial<FullMangaUnformatted>): FullMangaData {
  const out: FullMangaData = {
    manga: {} as unknown as MangaData,
    services: [],
    aliases: [],
  };

  if (obj.services) {
    out.services = obj.services;
    delete (obj).services;
  }

  if (obj.aliases) {
    out.aliases = obj.aliases;
    delete (obj).aliases;
  }

  out.manga = obj as Omit<FullMangaUnformatted, 'services' | 'aliases'>;

  return out;
}

export function getFullManga(mangaId: MangaId): Promise<FullMangaData | null> {
  return db.maybeOne(sql.type(FullMangaRawRow)`
      SELECT manga.manga_id,
          title,
          release_interval,
          latest_release,
          estimated_release,
          manga.latest_chapter,
          array_agg(json_build_object(
              'title_id',
              ms.title_id,
              'service_id',
              ms.service_id,
              'name',
              s.service_name,
              'url_format',
              chapter_url_format,
              'url',
              s.manga_url_format)) AS services,
          mi.cover,
          mi.status,
          mi.last_updated,
          mi.bw,
          mi.mu,
          mi.mal,
          mi.amz,
          mi.ebj,
          mi.engtl,
          mi.raw,
          mi.nu,
          mi.kt,
          mi.ap,
          mi.al,
          (
              SELECT array_agg(title)
              FROM manga_alias ma
              WHERE ma.manga_id = ${mangaId}
          ) AS aliases
      FROM manga
          LEFT JOIN manga_info mi ON manga.manga_id = mi.manga_id
          INNER JOIN manga_service ms ON manga.manga_id = ms.manga_id
          INNER JOIN services s ON ms.service_id = s.service_id
      WHERE manga.manga_id = ${mangaId}
      GROUP BY manga.manga_id, mi.manga_id`)
    .then(row => {
      if (!row) {
        return null;
      }

      const manga = camelcaseKeys(row, { deep: true }) as unknown as FullMangaUnformatted;

      const mdIdx = manga.services.findIndex(v => v.serviceId === MANGADEX_ID);
      // If info doesn't exist or 2 weeks since last update
      if ((!manga.lastUpdated || (Date.now() - (manga.lastUpdated as any)) / 8.64E7 > 14) && mdIdx >= 0) {
        fetchExtraInfo(manga.services[mdIdx].titleId, mangaId)
          .catch(mangadexLogger.error);
      }

      formatLinks(manga as unknown as Record<string, string>);
      return formatFullManga(manga);
    });
}


export async function getFollows(userId: DatabaseId | undefined): Promise<Follow[]> {
  if (!userId) {
    throw HttpError(404);
  }

  return db.any(sql.type(FollowRawRow)`
      SELECT m.title,
          mi.cover,
          m.manga_id,
          m.latest_release,
          m.latest_chapter,
          (
              SELECT json_agg(s)
              FROM (
                  SELECT ms.service_id,
                      service_name,
                      ms.title_id,
                      manga_url_format as url
                  FROM services
                      INNER JOIN manga_service ms ON services.service_id = ms.service_id
                  WHERE ms.manga_id = m.manga_id
                  ) s
              ) as services,
          json_agg(uf.service_id) as followed_services
      FROM user_follows uf
          INNER JOIN manga m ON uf.manga_id = m.manga_id
          LEFT JOIN manga_info mi ON m.manga_id = mi.manga_id
      WHERE user_id = ${userId}
      GROUP BY uf.manga_id, m.manga_id, mi.manga_id`)
    .then(rows => camelcaseKeys(rows, { deep: true }) as unknown as Follow[])
    .catch((err: unknown) => {
      if (err instanceof InvalidInputError) {
        throw HttpError(400, 'Invalid integer');
      }

      // integer overflow
      if (err instanceof DatabaseError && err.code === NUMERIC_VALUE_OUT_OF_RANGE) {
        throw HttpError(400, 'Integer out of range');
      }
      console.error(err);
      throw HttpError(500);
    });
}

export const getAliases = (mangaId: MangaId) => {
  return db.any(sql.type(z.object({ title: z.string() }))`SELECT title FROM manga_alias WHERE manga_id=${mangaId}`);
};

// Actually just gets a single row from the manga table
export const getMangaPartial = (mangaId: MangaId) => {
  return db.one(sql.type(MangaRow)`SELECT * FROM manga WHERE manga_id=${mangaId}`);
};

export type MangaForElastic = {
  mangaId: number;
  title: string;
  views: number;
  aliases: { title: string }[];
  services: { serviceId: number; serviceName: string }[];
};

export const getMangaForElastic = (mangaId: MangaId): Promise<MangaForElastic> => {
  return db.one(sql.type(MangaForElasticRawRow)`
      SELECT m.manga_id,
          m.title,
          m.views,
          (
              SELECT array_remove(array_agg(ma.title), NULL)
              FROM manga_alias ma
              WHERE ma.manga_id = m.manga_id
          ) AS aliases,
          array_agg(json_build_object(
              'service_id',
              s.service_id,
              'service_name',
              s.service_name)
          ) AS services
      FROM manga m
          INNER JOIN manga_service ms ON m.manga_id = ms.manga_id
          INNER JOIN services s ON s.service_id = ms.service_id
      WHERE m.manga_id = ${mangaId}
      GROUP BY m.manga_id, ms.manga_id`)
    .then(({ aliases, services, ...manga }) => ({
      ...manga,
      aliases: aliases?.map(title => ({ title })) ?? [],
      services: camelcaseKeys(services, { deep: true }),
    }));
};
