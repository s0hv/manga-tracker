import { useMemo } from 'react';

import { groupBy } from '@/common/utilities';
import type { ChapterRelease } from '@/types/api/chapter';

import type { GroupedChapters } from './types';

export const useGroupedChapters = (chapters: ChapterRelease[]): GroupedChapters[] => {
  return useMemo(
    () => groupBy(
      chapters,
      'mangaId',
      { keepOrder: false }
    ).map(group => ({
      mangaId: group[0].mangaId,
      chapters: group,
    })),
    [chapters]
  );
};
