import React, {
  type FC,
  type SyntheticEvent,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Autocomplete,
  Link,
  Paper,
  TableContainer,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { SortingState, TableOptions } from '@tanstack/react-table';
import { useSnackbar } from 'notistack';

import type { MangaChapter } from '@/types/api/chapter';
import type { MangaId } from '@/types/dbTypes';


import {
  deleteChapter,
  getChaptersQueryOptions,
  SortBy,
  updateChapter,
} from '../api/chapter';
import { getServicesQueryOptions } from '../api/services';
import { formatChapterUrl } from '../utils/formatting';
import { defaultDateFormat } from '../utils/utilities';

import { defaultOnSaveRow, MaterialTable } from './MaterialTable';
import type {
  AfterRowEdit,
  MaterialCellContext,
  MaterialColumnDef,
  RowChangeAction,
} from './MaterialTable/types';
import { createColumnHelper } from './MaterialTable/utilities';

type ServiceOption = {
  value: number
  label: string
};

type PaginationOptions = {
  limit: number
  offset: number
  sortingState?: SortBy<MangaChapter>[]
};

export interface MangaChapterWithUrl extends MangaChapter {
  url: string
}

const columnHelper = createColumnHelper<MangaChapterWithUrl>();


const TitleCell = ({ row }: MaterialCellContext<MangaChapterWithUrl, any>) => (
  <Link href={row.original.url} target='_blank' style={{ textDecoration: 'none' }} rel='noopener noreferrer'>
    <span>
      {row.original.title}
    </span>
  </Link>
);

const allSelectedLabel = () => 'All services selected';

type ServiceFilterProps = {
  serviceMangaData?: Record<number, ServiceMangaData>
  onChange: (services: number[] | undefined) => void
};
const ServiceFilter: FC<ServiceFilterProps> = ({ serviceMangaData, onChange }) => {
  const { data: services } = useQuery(getServicesQueryOptions);

  const serviceOptions = useMemo(() => {
    if (!serviceMangaData) return [];

    return Object.keys(serviceMangaData).map(id => ({
      value: Number(id),
      label: services?.[Number(id)]?.name ?? `Service ${id}`,
    }));
  }, [serviceMangaData, services]);

  const [selectedServices, setSelectedServices] = useState<ServiceOption[]>(serviceOptions);

  useEffect(() => {
    setSelectedServices(serviceOptions);
  }, [serviceOptions]);

  const handleChange = useCallback((_: SyntheticEvent, value: ServiceOption[]) => {
    setSelectedServices(value);

    if (value.length === 0 || value.length === serviceOptions.length) {
      onChange(undefined);
      return;
    }

    onChange(value.map(option => option.value));
  }, [onChange, serviceOptions.length]);

  const allServicesSelected =
    selectedServices.length === serviceOptions.length
    || selectedServices.length === 0;

  return (
    <Autocomplete
      options={serviceOptions}
      value={selectedServices}
      onChange={handleChange}
      renderInput={params => <TextField {...params} label='Filter services' />}
      renderValue={allServicesSelected ? allSelectedLabel : undefined}
      sx={{
        width: 'fit-content',
        minWidth: '200px',
        mt: 4,
        mb: '-55px',
        zIndex: 10,
        position: 'relative',
      }}
      disableClearable
      multiple
    />
  );
};

export type ServiceMangaData = {
  urlFormat: string
  titleId: string
};

export type ChapterListProps = {
  editable?: boolean
  serviceMangaData?: Record<number, ServiceMangaData>
  mangaId: MangaId
};

function ChapterList(props: ChapterListProps): ReactElement {
  const {
    editable = false,
    serviceMangaData,
    mangaId,
  } = props;

  const [selectedServices, setSelectedServices] = useState<number[] | undefined>(undefined);
  const [paginationOptions, setPaginationOptions] = useState<PaginationOptions | undefined>(undefined);
  const { enqueueSnackbar } = useSnackbar();
  const { data: services } = useQuery(getServicesQueryOptions);

  const {
    data,
    isFetching: loading,
    refetch,
  } = useQuery({
    ...getChaptersQueryOptions(
      mangaId,
      /* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
      paginationOptions?.limit!,
      paginationOptions?.offset!,
      paginationOptions?.sortingState!,
      /* eslint-enable @typescript-eslint/no-non-null-asserted-optional-chain */
      selectedServices
    ),
    enabled: paginationOptions !== undefined,
    select: data => {
      return {
        chapters: formatChapters(data.chapters ?? []),
        count: Number(data.count),
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { chapters = [], count = 0 } = data ?? {};

  const formatChapters = useCallback<(chapters: MangaChapter[]) => MangaChapterWithUrl[]>(chs => {
    if (!chs) return [];

    return chs.map(chapter => {
      const newChapter = { ...chapter } as MangaChapterWithUrl;

      if (!serviceMangaData) return newChapter;

      const mangaData = serviceMangaData[chapter.serviceId];
      if (mangaData) {
        newChapter.url = formatChapterUrl(mangaData.urlFormat, chapter.chapterIdentifier, mangaData.titleId)!;
      }

      return newChapter;
    });
  }, [serviceMangaData]);

  const handleResponse = useCallback((json: { message: string }) => {
    enqueueSnackbar(json.message, { variant: 'success' });
  }, [enqueueSnackbar]);

  const onSaveRow = useCallback<AfterRowEdit<MangaChapterWithUrl>>((state, ctx) => {
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    defaultOnSaveRow(state, ctx);

    updateChapter(ctx.row.original.chapterId, state)
      .then(handleResponse)
      .catch(err => {
        enqueueSnackbar(err.message, { variant: 'error' });
      });
  }, [handleResponse, enqueueSnackbar]);

  const onDeleteRow = useCallback<RowChangeAction<MangaChapterWithUrl>>(({ row }) => {
    const id = row.original.chapterId;

    deleteChapter(id)
      .then(handleResponse)
      .catch(err => {
        enqueueSnackbar(err.message, { variant: 'error' });
      })
      .finally(refetch);
  }, [handleResponse, enqueueSnackbar, refetch]);

  const columns = useMemo<MaterialColumnDef<MangaChapterWithUrl, any>[]>(() => [
    columnHelper.accessor('chapterNumber', {
      header: 'Ch.',
      enableEditing: false,
      width: '50px',
      cell: ({ row }) => {
        const {
          chapterNumber,
          chapterDecimal,
        } = row.original;

        return `${chapterNumber}${typeof chapterDecimal === 'number' ? '.' + chapterDecimal : ''}`;
      },
    }),
    columnHelper.accessor('title', {
      header: 'Title',
      enableSorting: false,
      cell: TitleCell,
    }),
    columnHelper.accessor('releaseDate', {
      header: 'Released',
      enableEditing: false,
      sortingFn: 'datetime',
      cell: ({ row }) => defaultDateFormat(row.original.releaseDate),
    }),
    columnHelper.accessor('group', {
      header: 'Group',
      enableEditing: false,
    }),
    columnHelper.accessor('serviceId', {
      header: 'Service',
      enableEditing: false,
      cell: ({ row }) => {
        const serviceId = row.original.serviceId;
        return services?.[serviceId]?.name ?? '';
      },
    }),
  ], [services]);

  const getRowId = useCallback<(row: MangaChapterWithUrl) => string>(row => row.chapterId.toString(), []);

  const fetchData = useCallback((pageIndex: number, pageSize: number, sortBy?: SortingState) => {
    const offset = pageIndex * pageSize;

    setPaginationOptions({
      limit: pageSize,
      offset,
      sortingState: sortBy as SortBy<MangaChapter>[],
    });
  }, []);

  const [tableOptions] = useState<Partial<TableOptions<MangaChapterWithUrl>>>({ getRowId });

  return (
    <TableContainer component={Paper}>
      <ServiceFilter
        serviceMangaData={serviceMangaData}
        onChange={setSelectedServices}
      />
      <MaterialTable
        columns={columns}
        data={chapters}
        onSaveRow={onSaveRow}
        onDeleteRow={onDeleteRow}
        fetchData={fetchData}
        rowCount={count}
        loading={loading}
        sortable
        editable={editable}
        deletable={editable}
        pagination
        tableOptions={tableOptions}
        arialLabel='Manga chapters'
        sx={{ minWidth: '600px' }}
      />
    </TableContainer>
  );
}
export default ChapterList;
