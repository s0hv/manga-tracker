import React, { type PropsWithChildren } from 'react';

import type { ChapterRelease } from '@/types/api/chapter';
import type { DatabaseId } from '@/types/dbTypes';
import type { HasRequiredKeys } from '@/types/utility';

export type ChapterComponentProps<TExtraProps extends object = object> = TExtraProps & {
  chapter: ChapterRelease
};

export type GroupComponentProps<TExtraProps extends object = object> = PropsWithChildren<TExtraProps & {
  groupString: string | React.ReactNode
  group: DatabaseId
  groupItems: ChapterRelease[]
  mangaId: DatabaseId
}>;

export interface GroupedChapters {
  mangaId: number
  chapters: ChapterRelease[]
}

/**
 * Marks a value in `TKey` optional if its value does not contain any required values.
 *
 * e.g. `ExtraPropsField<'test', { id: number }>` returns `{ test: { id: number }`,
 * while `ExtraPropsField<'test', { id?: number }>` returns `{ test?: { id?: number }`,
 */
export type ExtraPropsField<TKey extends string, TExtraProps extends object> =
  HasRequiredKeys<TExtraProps> extends true
    ? Record<TKey, TExtraProps>
    : Partial<Record<TKey, TExtraProps>>;
