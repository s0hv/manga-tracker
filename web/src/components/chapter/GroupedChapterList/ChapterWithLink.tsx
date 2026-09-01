import React, { type FC, useMemo } from 'react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';

import type { ServiceForApi } from '@/types/api/services';
import { formatChapterTitle, formatChapterUrl } from '@/webUtils/formatting';
import { defaultDateFormat } from '@/webUtils/utilities';

import { CSS_VARS } from './constants';
import type { ChapterComponentProps } from './types';

type ChapterWithLinkProps = ChapterComponentProps<{ services: Record<number, ServiceForApi> }>;

export const ChapterWithLink: FC<ChapterWithLinkProps> = ({
  chapter,
  services,
}) => {
  const service = services[chapter.serviceId];
  const {
    releaseDateStr,
    relativeReleaseDate,
  } = useMemo(() => {
    const releaseDate = new Date(chapter.releaseDate);
    const relativeReleaseDate = formatDistanceToNowStrict(releaseDate);

    return {
      relativeReleaseDate,
      releaseDateStr: defaultDateFormat(releaseDate),
    };
  }, [chapter.releaseDate]);

  const chapterUrl = useMemo(
    () =>
      formatChapterUrl(service.chapterUrlFormat, chapter.chapterIdentifier, chapter.titleId),
    [service.chapterUrlFormat, chapter]
  );

  return (
    <Box
      component='a'
      href={chapterUrl}
      target='_blank'
      rel='noopener noreferrer'
      sx={{
        width: '100%',
        textDecoration: 'none',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
        color: 'text.primary',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        px: '0.5rem',
        py: `var(${CSS_VARS.chapterRowGap})`,
        borderTop: '1px solid',
        borderColor: 'divider',
        whiteSpace: 'nowrap',
        minWidth: 'fit-content',
      }}
    >
      <Typography
        component='span'
        variant='body1'
        sx={{ mr: 1 }}
      >
        {formatChapterTitle(chapter)}
      </Typography>

      <Typography
        variant='body2'
        color='textSecondary'
        sx={{
          display: 'flex',
          gap: '8px',
        }}
      >
        <span>
          {service.name}
        </span>

        <span>
          ·
        </span>

        <Tooltip
          title={releaseDateStr}
          enterDelay={0}
          placement='top'
        >
          <Box
            component='span'
            sx={{
              borderBottom: '1px dotted',
            }}
          >
            {relativeReleaseDate} ago
          </Box>
        </Tooltip>
      </Typography>

      <IconButton
        disableFocusRipple
        disableRipple
        aria-label='Open chapter in new tab'
        sx={{ ml: 'auto' }}
        size='small'
      >
        <OpenInNewIcon />
      </IconButton>
    </Box>
  );
};
