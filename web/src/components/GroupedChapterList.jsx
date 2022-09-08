import propTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { Paper, Container, Typography, IconButton } from '@mui/material';

import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { groupBy } from '../utils/utilities';
import { formatChapterTitle, formatChapterUrl } from '../utils/formatting';
import { MangaCover } from './MangaCover';


export const ChapterGroupBase = ({ groupString, children }) => (
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

export const ChapterGroupWithCover = (mangaToCover) => ({ group, groupString, children }) => (
  <ChapterGroupBase groupString={groupString}>
    <div style={{ display: 'flex' }}>
      <div>
        <MangaCover
          url={mangaToCover[group]}
          alt={groupString}
          maxWidth={96}
        />
      </div>
      <div>
        {children}
      </div>
    </div>
  </ChapterGroupBase>
);

export const ChapterWithLink = (services) => ({ chapter }) => {
  const service = services[chapter.serviceId];
  return (
    <li>
      <div>
        {formatChapterTitle(chapter)}
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


export const GroupedChapterList = ({
  chapters,
  groupKey,
  groupToString = (group) => group,
  GroupComponent,
  ChapterComponent,
}) => {
  const [groupedChapters, setGroupedChapters] = useState([]);
  useEffect(() => {
    setGroupedChapters(groupBy(chapters, groupKey));
  }, [chapters, groupKey]);

  return (
    <Container maxWidth='lg' disableGutters>
      {groupedChapters.map((group, idx) => (
        <GroupComponent
          groupString={groupToString(group.group, group.arr)}
          group={group.group}
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

GroupedChapterList.propTypes = {
  chapters: propTypes.arrayOf(propTypes.object),
  groupKey: propTypes.oneOfType([propTypes.string, propTypes.func]),
  groupToString: propTypes.func,
  GroupComponent: propTypes.func,
  ChapterComponent: propTypes.func,
};

export default GroupedChapterList;
