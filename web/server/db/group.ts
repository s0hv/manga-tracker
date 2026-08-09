import type { SearchGroup } from '#common/schemas/group';

import { db } from './helpers';

export const searchGroups = (name: string, limit: number) => {
  return db.any<SearchGroup>`
    SELECT group_id, name
    FROM groups 
    WHERE name ILIKE ${`%${name}%`}
    ORDER BY name = ${name}, name
    LIMIT ${limit}`;
};
