import { SearchGroup } from '#common/schemas/group';

import { db, sql } from './index';

export const searchGroups = (name: string, limit: number) => {
  return db.any(sql.type(SearchGroup)`
    SELECT group_id, name
    FROM groups
    WHERE name ILIKE ${`%${name}%`}
    ORDER BY name = ${name}, name
    LIMIT ${limit}`);
};
