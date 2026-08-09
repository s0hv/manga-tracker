import * as z from 'zod';

import { dbId } from '#common/schemas/common';


export const DbGroup = z.strictObject({
  groupId: dbId,
  name: z.string().min(1),
  mangadexId: z.uuidv4().nullable(),
});

export type DbGroup = z.infer<typeof DbGroup>;

export const SearchGroup = DbGroup.omit({ mangadexId: true });
export type SearchGroup = z.infer<typeof SearchGroup>;
