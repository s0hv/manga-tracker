import { mutationOptions, queryOptions } from '@tanstack/react-query';

import {
  type ChapterFail,
  ChaptersFailedResponse,
} from '#web/schemas/admin/chaptersFailed';
import type { DbChapterCreate } from '@/common/schemas/chapter';

import { baseKy } from '../utilities';

const chaptersFailedUrls = {
  chaptersFailed: '/admin/chapters-failed',
  fix: '/admin/chapters-failed/fix',
  chapterFail: (serviceId: number, chapterIdentifier: string) =>
    `/admin/chapters-failed/${serviceId}/${chapterIdentifier}`,
} as const;

const chapterFailedQueryKeyPrefix = [chaptersFailedUrls.chaptersFailed];

export const getChaptersFailed = (limit: number, offset?: number) => baseKy
  .get(chaptersFailedUrls.chaptersFailed, {
    searchParams: {
      limit,
      offset,
    },
  })
  .json()
  .then(ChaptersFailedResponse.parseAsync)
  .then(res => res.data);

export const getChaptersFailedQueryOptions = (limit: number, offset?: number) => queryOptions({
  queryKey: [chaptersFailedUrls.chaptersFailed, limit, offset] as const,
  queryFn: ({ queryKey }) => getChaptersFailed(queryKey[1], queryKey[2]),
});

export const fixChapterFailed = (newChapter: DbChapterCreate) => baseKy
  .post(chaptersFailedUrls.fix, { json: newChapter });

export const fixChapterFailedMutationOptions = mutationOptions({
  mutationFn: fixChapterFailed,
  meta: {
    queryKeysToInvalidate: [chapterFailedQueryKeyPrefix],
    invalidateOnError: true,
  },
});

export const deleteChapterFail = (serviceId: number, chapterIdentifier: string) => baseKy
  .delete(chaptersFailedUrls.chapterFail(serviceId, chapterIdentifier));

export const deleteChapterFailMutationOptions = mutationOptions({
  mutationFn: ({
    serviceId,
    chapterIdentifier,
  }: Pick<ChapterFail, 'serviceId' | 'chapterIdentifier'>) =>
    deleteChapterFail(serviceId, chapterIdentifier),

  meta: {
    queryKeysToInvalidate: [chapterFailedQueryKeyPrefix],
    invalidateOnError: true,
  },
});
