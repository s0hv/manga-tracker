import React, {
  type FC,
  type PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Container,
  IconButton,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
} from '@mui/material';

import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { type GetKey, type Group, groupBy } from '@/common/utilities';
import { formatChapterTitle, formatChapterUrl } from '../utils/formatting';
import { MangaCover } from './MangaCover';
import type { ServiceForApi } from '@/types/api/services';
import type { ChapterRelease } from '@/types/api/chapter';
import { defaultDateFormat } from '@/webUtils/utilities';
import type { DatabaseId } from '@/types/dbTypes';

export type ChapterComponentProps = {
  chapter: ChapterRelease
}

export type GroupComponentProps = PropsWithChildren<{
  groupString: string | React.ReactNode
  group: DatabaseId
  mangaId: DatabaseId
}>

export const ChapterGroupBase: FC<Omit<GroupComponentProps, 'group' | 'mangaId'>> = ({ groupString, children }) => (
  <Paper sx={{
    mb: 1,
    pt: 2,
    pl: 2,
    pb: '1px',
  }}
  >
    <Typography variant='h6'>{groupString}</Typography>
    {children}
  </Paper>
);

export const ChapterGroupWithCover = (mangaToCover: Record<DatabaseId, string>): FC<GroupComponentProps> => (
  { mangaId, group, groupString, children }
) => (
  <ChapterGroupBase groupString={groupString}>
    <div style={{ display: 'flex' }}>
      <div>
        <a href={`/manga/${mangaId}`} target='_blank' rel='noopener noreferrer'>
          <MangaCover
            url={mangaToCover[group]}
            alt={groupString}
            maxWidth={96}
          />
        </a>
      </div>
      <div>
        {children}
      </div>
    </div>
  </ChapterGroupBase>
);

export const ChapterWithLink = (services: Record<number, ServiceForApi>): FC<ChapterComponentProps> => ({ chapter }) => {
  const service = services[chapter.serviceId];
  return (
    <li>
      <div>
        <Tooltip
          title={defaultDateFormat(new Date(chapter.releaseDate))}
          arrow
          slotProps={{
            tooltip: {
              sx: {
                fontSize: '1rem',
              },
            },
          }}
        >
          <span>
            {formatChapterTitle(chapter)}
          </span>
        </Tooltip>
        <a
          href={formatChapterUrl(service.chapterUrlFormat, chapter.chapterIdentifier, chapter.titleId)}
          target='_blank'
          rel='noopener noreferrer'
        >
          <IconButton
            disableFocusRipple
            disableRipple
            aria-label='Open chapter in new tab'
          >
            <OpenInNewIcon />
          </IconButton>
        </a>
        {service.name}
      </div>
    </li>
  );
};


export type GroupedChapterListProps = {
  chapters: ChapterRelease[]
  groupKey: keyof ChapterRelease | GetKey<ChapterRelease>
  groupToString: (group: string, arr: ChapterRelease[]) => string
  GroupComponent: React.ComponentType<GroupComponentProps>
  ChapterComponent: React.ComponentType<ChapterComponentProps>
  loading?: boolean
  skeletons?: number
}

export const GroupedChapterList: FC<GroupedChapterListProps> = ({
  chapters,
  groupKey,
  groupToString = (group) => group,
  GroupComponent,
  ChapterComponent,
  loading = false,
  skeletons,
}) => {
  const [groupedChapters, setGroupedChapters] = useState<Group<ChapterRelease>[]>([]);
  useEffect(() => {
    setGroupedChapters(groupBy(chapters, groupKey));
  }, [chapters, groupKey]);

  const skeletonArray = useMemo(() => {
    if (skeletons) return new Array(skeletons).fill(0);

    return [];
  }, [skeletons]);

  return (
    <Container maxWidth='lg' disableGutters>
      {loading && skeletons && skeletonArray.map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <ChapterGroupBase groupString={<Skeleton width='75%' />} key={`${i}`}>
          <div style={{ display: 'flex' }}>
            <div>
              <Skeleton width={96} height={134} variant='rounded' sx={{ mr: 2 }} />
            </div>
            <div>
              <Skeleton width={300} />
              <Skeleton width={300} />
              <Skeleton width={300} />
            </div>
          </div>
        </ChapterGroupBase>
      ))}
      {!loading && groupedChapters.map((group, idx) => (
        <GroupComponent
          groupString={groupToString(group.group, group.arr)}
          group={group.group}
          mangaId={group.arr[0].mangaId}
          /* eslint-disable-next-line react/no-array-index-key */
          key={`${idx}`}
        >
          <ol style={{ listStyleType: 'none' }}>
            {group.arr.map((chapter) => (
              <ChapterComponent key={chapter.chapterId} chapter={chapter} />
            ))}
          </ol>
        </GroupComponent>
      ))}
    </Container>
  );
};

export default GroupedChapterList;
