import React, { useMemo } from 'react';
import { CircularProgress, Grid, Link } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { type Control, useWatch } from 'react-hook-form';

import { getMangaQueryOptions } from '#web/api/manga';
import { RouteLink } from '@/components/common/RouteLink';
import { MangaCover } from '@/components/MangaCover';
import { formatTitleUrl } from '@/webUtils/formatting';

type FormValues = { manga: { mangaId: number } | null };

export interface ShortMangaInfoProps<TFieldValues extends FormValues> {
  control: Control<TFieldValues>
  serviceId?: number
}

export const ShortMangaInfo = <
  TFieldValues extends FormValues
>({
  control: ctrl,
  serviceId,
}: ShortMangaInfoProps<TFieldValues>) => {
  const control = ctrl as unknown as Control<FormValues>;
  const mangaId = useWatch({ control, name: 'manga.mangaId' }) ?? null;

  const {
    data,
    isLoading,
  } = useQuery(getMangaQueryOptions(mangaId));

  const serviceUrl = useMemo(() => {
    if (!serviceId || !data) return;

    const serviceData = data.services.find(s => s.serviceId === serviceId);

    if (!serviceData) return;

    return formatTitleUrl(serviceData.url, serviceData.titleId);
  }, [data, serviceId]);

  if (!mangaId) {
    return null;
  }

  if (isLoading || !data) {
    return <CircularProgress size={30} aria-label='Loading icon' />;
  }

  const { manga } = data;

  return (
    <Grid
      container
      spacing={2}
      sx={{
        alignItems: 'center',
      }}
    >
      <MangaCover
        url={manga.cover}
        alt={manga.title}
        size={256}
        maxWidth={96}
        minWidth='96px'
      />

      <RouteLink
        to='/manga/$mangaId'
        target='_blank'
        preload={false}
        params={{ mangaId: manga.mangaId.toString() }}
        sx={{ height: 'fit-content' }}
      >
        {manga.title}
      </RouteLink>

      {serviceId && (
        <Link
          href={serviceUrl}
          target='_blank'
          rel='noopener noreferrer'
          sx={{ height: 'fit-content' }}
        >
          To service
        </Link>
      )}
    </Grid>
  );
};
