import React, { useMemo, useState } from 'react';
import BuildIcon from '@mui/icons-material/Build';
import DeleteIcon from '@mui/icons-material/Delete';
import { Grid, IconButton, Link, Paper, TableContainer } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { TableOptions } from '@tanstack/react-table';
import { useConfirm } from 'material-ui-confirm';

import {
  deleteChapterFailMutationOptions,
  getChaptersFailedQueryOptions,
} from '#web/api/admin/chaptersFailed';
import { getServicesQueryOptions } from '#web/api/services';
import type { ChapterFail } from '#web/schemas/admin/chaptersFailed';
import {
  type AddChapterInitialValues,
  AddChapterModal,
} from '@/components/chapter/AddChapterModal';
import { MaterialTable } from '@/components/MaterialTable';
import type { MaterialColumnDef } from '@/components/MaterialTable/types';
import { createColumnHelper } from '@/components/MaterialTable/utilities';
import { noRows } from '@/webUtils/constants';
import { defaultDateFormat } from '@/webUtils/utilities';

const columnHelper = createColumnHelper<ChapterFail>();

const mapFailToChapterInitialValues = (chapterFail: ChapterFail): AddChapterInitialValues => ({
  serviceId: chapterFail.serviceId,
  chapterIdentifier: chapterFail.chapterIdentifier,
  chapterDecimal: chapterFail.chapterDecimal,
  chapterNumber: chapterFail.chapterNumber ?? null,
  group: chapterFail.group
    ? {
      groupId: null,
      name: chapterFail.group,
    }
    : null,
  manga: chapterFail.mangaId
    ? {
      mangaId: chapterFail.mangaId,
      title: chapterFail.mangaId.toString(),
    }
    : null,
  releaseDate: chapterFail.releaseDate ?? null,
  title: chapterFail.title ?? null,
});

const tableOptions: Partial<TableOptions<ChapterFail>> = {
  getRowId: originalRow => `${originalRow.serviceId}-${originalRow.chapterIdentifier}`,
};

export const ChaptersFailed = () => {
  const deleteChapterFailed = useMutation(deleteChapterFailMutationOptions);
  const confirm = useConfirm();

  const [chapterInitialValues, setChapterInitialValues] = useState<AddChapterInitialValues | null>(null);

  // TODO currently hardcoded to 50 latest chapters because the table
  // element does not really support react query that well
  const {
    data: chaptersFailed,
    isFetching: chaptersFetching,
  } = useQuery(getChaptersFailedQueryOptions(50));

  const {
    data: services,
    isFetching: servicesFetching,
  } = useQuery(getServicesQueryOptions);

  const isLoading = chaptersFetching
    || servicesFetching;

  const columns = useMemo<MaterialColumnDef<ChapterFail, any>[]>(() => [
    {
      header: '',
      id: 'fixChapter',
      cell: ({ row: { original: row }}) => (
        <Grid container spacing={1} wrap='nowrap'>
          <IconButton
            onClick={() => setChapterInitialValues(
              mapFailToChapterInitialValues(row)
            )}
            aria-label='create chapter from row'
            size='large'
          >
            <BuildIcon />
          </IconButton>

          <IconButton
            onClick={() => confirm({
              title: 'Delete Chapter Fail',
              content: 'Are you sure you want to delete this chapter fail?',
              confirmationText: 'Delete',
            }).then(result => {
              if (!result.confirmed) {
                return;
              }

              deleteChapterFailed.mutate(row);
            })}
            aria-label='delete chapter fail'
            size='large'
          >
            <DeleteIcon />
          </IconButton>
        </Grid>
      ),
    },

    columnHelper.accessor('chapterIdentifier', {
      header: 'Chapter identifier',
      minSize: 250,
    }),

    columnHelper.accessor('serviceId', {
      header: 'Service',
      cell: ({ row }) => services?.[row.original.serviceId].name,
      minSize: 100,
    }),

    columnHelper.accessor('errors', {
      header: 'Error',
      minSize: 200,
    }),

    columnHelper.accessor('titleId', {
      header: 'Title ID',
      minSize: 200,
      cell: ({ row }) => {
        const titleId = row.original.titleId;
        const service = services?.[row.original.serviceId];

        if (!titleId || !service) return titleId;

        return (
          <Link
            href={service.mangaUrlFormat.replace('{}', titleId)}
            target='_blank'
            rel='noopener noreferrer'
            underline='hover'
          >
            {titleId}
          </Link>
        );
      },
    }),

    columnHelper.accessor('mangaTitle', {
      header: 'Manga title',
      minSize: 250,
    }),

    columnHelper.accessor('releaseDate', {
      header: 'Release date',
      minSize: 200,
      cell: ({ row }) => defaultDateFormat(row.original.releaseDate),
    }),

    columnHelper.accessor('group', {
      header: 'Group',
      minSize: 100,
    }),
  ], [confirm, deleteChapterFailed, services]);

  return (
    <TableContainer component={Paper} sx={{ px: 4 }}>
      {chapterInitialValues && (
        <AddChapterModal
          initialValues={chapterInitialValues}
          isOpen
          onClose={() => setChapterInitialValues(null)}
        />
      )}

      <MaterialTable
        title='Chapters that could not be parsed'
        columns={columns}
        data={chaptersFailed ?? noRows}
        rowCount={chaptersFailed?.length ?? 0}
        loading={isLoading}
        // Disabled for now
        // pagination
        tableOptions={tableOptions}
        ariaLabel='Chapters that could not be parsed'
        sx={{ minWidth: '600px' }}
      />
    </TableContainer>
  );
};
