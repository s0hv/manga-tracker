import type { DbChapterCreate } from '@/common/schemas/chapter';
import { DbGroup } from '@/common/schemas/group';
import { NoResultsError } from '@/db/errors';
import { BadRequest, NotFound } from '@/serverUtils/errors';
import { rethrowMappedError } from '@/serverUtils/utilities';
import type { ChapterFail } from '@/types/db/chapterFail';

import { db } from './helpers';

export const getChapterFails = (limit: number, offset: number) => {
  return db.any<ChapterFail>`
    SELECT * 
    FROM chapters_failed 
    ORDER BY service_id DESC, chapter_identifier, timestamp DESC
    LIMIT ${limit} OFFSET ${offset}`;
};

export const deleteChapterFail = async (serviceId: number, chapterIdentifier: string) => {
  const res = await db.sql`
      DELETE
      FROM chapters_failed
      WHERE service_id = ${serviceId}
        AND chapter_identifier = ${chapterIdentifier}`;

  return res.count;
};

export const fixFailedChapter = (chapterData: DbChapterCreate) => {
  return db.transaction(async tran => {
    // Ensure that a failed chapter exists
    await tran.one`
      SELECT 1 
      FROM chapters_failed
      WHERE service_id=${chapterData.serviceId} AND chapter_identifier=${chapterData.chapterIdentifier}`
      .catch(rethrowMappedError([NoResultsError, new NotFound('Chapter fail not found')]));

    // Ensure that the manga exists
    await tran.one`SELECT 1 FROM manga WHERE manga_id=${chapterData.mangaId}`
      .catch(rethrowMappedError([NoResultsError, new NotFound('Manga not found for new chapter')]));

    // Create or get an existing group
    const newGroup = chapterData.group;
    let groupId: number;

    if (newGroup.groupId === null) {
      const group = await tran.oneOrNone`
          SELECT *
          FROM groups
          WHERE name = ${newGroup.name}`
        .then(row => row ? DbGroup.parseAsync(row) : null);

      if (group) {
        groupId = group.groupId;
      } else {
        const createdGroup = await tran.one<{ groupId: number }>`
            INSERT INTO groups (name)
            VALUES (${newGroup.name})
            RETURNING group_id`;

        groupId = createdGroup.groupId;
      }
    } else {
      const group = await tran.one`SELECT * FROM groups WHERE group_id=${newGroup.groupId}`
        .catch(rethrowMappedError([NoResultsError, new NotFound('Group not found')]))
        .then(DbGroup.parseAsync);

      if (newGroup.name && group.name !== newGroup.name) {
        throw new BadRequest(`Group name in body (${newGroup.name}) and database (${group.name}) do not match`);
      }

      groupId = group.groupId;
    }

    // Insert the new chapter
    await tran.none`
      INSERT INTO chapters
          (manga_id,
           service_id, 
           title,
           chapter_number,
           chapter_decimal, 
           release_date, 
           chapter_identifier,
           group_id)
      VALUES
          (${chapterData.mangaId},
           ${chapterData.serviceId},
           ${chapterData.title},
           ${chapterData.chapterNumber},
           ${chapterData.chapterDecimal},
           ${chapterData.releaseDate},
           ${chapterData.chapterIdentifier},
           ${groupId})`;

    // Finally, delete the failed chapter
    await tran.none`
        DELETE FROM chapters_failed
        WHERE service_id = ${chapterData.serviceId}
          AND chapter_identifier = ${chapterData.chapterIdentifier}`;
  });
};
