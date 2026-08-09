import * as z from 'zod';

import { SearchGroup } from '@/common/schemas/group';

export const SearchGroupResponse = z.object({
  data: z.array(SearchGroup),
});
export type SearchGroupResponse = z.infer<typeof SearchGroupResponse>;
