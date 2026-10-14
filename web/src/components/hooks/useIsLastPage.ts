import { useMemo } from 'react';
import { last } from 'es-toolkit';

import type { PageParams } from '#web/api/types';
import { MAX_OFFSET } from '@/webUtils/constants';

export function useIsLastPage(pageParams: PageParams[], pages: unknown[][], pageSize: number) {
  return useMemo(
    () => {
      const lastPage = last(pageParams);
      if (!lastPage) return false;

      return lastPage.offset >= MAX_OFFSET
        || (last(pages) ?? []).length < pageSize;
    },
    [pageParams, pageSize, pages]
  );
}
