import React, { type RefCallback, useMemo } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';

import type { SearchedMangaSchema } from '@/common/schemas/manga';
import { RouteLink } from '@/components/common/RouteLink';
import { MangaCover } from '@/components/MangaCover';
import { statusToColor, statusToString } from '@/webUtils/utilities';

export interface MangaForSearchProps {
  manga: SearchedMangaSchema;
  maxWidth?: number;
  ref?: RefCallback<HTMLElement>;
}

export const MangaForSearch = ({
  manga,
  maxWidth = 128,
  ref,
}: MangaForSearchProps) => {
  const latestRelease = useMemo(
    () => manga.latestRelease
      ? `${formatDistanceToNowStrict(new Date(manga.latestRelease))} ago`
      : 'Unknown',
    [manga.latestRelease]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexFlow: 'column',
        justifyContent: 'space-between',
        gap: 1,
      }}
      ref={ref}
    >
      <Box
        sx={theme => ({
          position: 'relative',
          display: 'flex',
          borderRadius: 1,
          '&:hover': {
            boxShadow: 6,
            ...theme.applyStyles('dark', {
              // Same as boxShadow: 6, except with 255 instead of 0 for colors
              boxShadow: '0 3px 5px -1px rgba(255,255,255,.2), 0 6px 10px 0 rgba(255,255,255,.14), 0 1px 18px 0 rgba(255,255,255,.12)',
            }),
          },
        })}
      >
        <Chip
          variant='filled'
          label={statusToString(manga.status)}
          size='small'
          icon={(
            <Box sx={{
              borderRadius: 4,
              backgroundColor: statusToColor(manga.status),
              minWidth: '6px',
              minHeight: '6px',
            }}
            />
          )}
          sx={theme => ({
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'white',
            boxShadow: 2,
            zIndex: 100,
            ...theme.applyStyles('dark', {
              color: 'secondary.contrastText',
            }),
          })}
        />

        <RouteLink
          to='/manga/$mangaId'
          params={{ mangaId: manga.mangaId.toString() }}
          sx={{
            textDecoration: 'none',
            color: 'inherit',
            // These styles make the cover fill the container. Without them,
            // the size might not fit in special cases such as no cover or when
            // the image fails to load.
            height: '100%',
            width: '100%',
            alignContent: 'center',
            display: 'flex',
            position: 'relative',
          }}
        >
          <MangaCover
            url={manga.coverUrl}
            alt={manga.title}
            maxWidth={maxWidth}

            style={{
              // Use 18/27 aspect ratio for placeholders.
              // Images will use image aspect ratio due to the auto modifier
              aspectRatio: '18 / 27 auto',
              // This will center the alt text in case the image fails to load
              alignContent: 'center',
            }}
            usePlaceholder
          />
        </RouteLink>

        <Box
          sx={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'space-between',
            alignItems: 'end',
            width: '100%',
            height: '25%',
            position: 'absolute',
            bottom: '0px',
            px: 1,
            pb: '5%',
            borderRadius: 1,
            background: 'linear-gradient(to top,rgba(0,0,0,.8) 0%,rgba(0,0,0,.6) 50%,rgba(0,0,0,0) 100%)',
            // Allow clicking through the gradient to access the link
            pointerEvents: 'none',
          }}
        >
          <Typography sx={{
            fontSize: '0.85rem',
            // Enable pointer events back for the text so it can be selected
            pointerEvents: 'all',
          }}
          >
            Ch. {manga.latestChapter}
          </Typography>
          <Typography
            color='textSecondary'
            sx={{
              fontSize: '0.85rem',
              // Enable pointer events back for the text so it can be selected
              pointerEvents: 'all',
            }}
          >
            {latestRelease}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
        }}
      >
        <RouteLink
          to='/manga/$mangaId'
          params={{ mangaId: manga.mangaId.toString() }}
          sx={{
            textDecoration: 'none',
            color: 'inherit',
            width: 'fit-content',
          }}
        >
          <Typography>
            {manga.title}
          </Typography>
        </RouteLink>

        <Typography color='textSecondary' variant='body2'>
          21 chapters
        </Typography>
      </Box>
    </Box>
  );
};
