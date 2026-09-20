import * as z from 'zod';

import { SearchGroup } from '@/common/schemas/group';

export const SearchGroupResponse = z.strictObject({
  data: z.array(SearchGroup),
});
export type SearchGroupResponse = z.infer<typeof SearchGroupResponse>;
