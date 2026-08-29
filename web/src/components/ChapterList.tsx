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
import {
  type CellContext,
  type PaginationState,
  type Row,
  type SortingState,
  ColumnDef,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useConfirm } from 'material-ui-confirm';
import { useSnackbar } from 'notistack';

import { DEFAULT_PAGE_SIZE } from '@/components/MaterialTable/constants';
import {
  defaultOnSaveRow,
  getDeleteColumnDef,
  getEditColumnDef,
  getRowEditStateFromRow,
  rowDeletingPlugin,
  rowEditingPlugin,
} from '@/components/MaterialTable/plugins';
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

import { MaterialTable } from './MaterialTable';

type ServiceOption = {
  value: number
  label: string
};

export interface MangaChapterWithUrl extends MangaChapter {
  url: string
}

function getRowId(row: MangaChapterWithUrl) {
  return row.chapterId.toString();
}

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  rowDeletingPlugin,
  rowEditingPlugin,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});
type Features = typeof features;

const columnHelper = createColumnHelper<Features, MangaChapterWithUrl>();
const editColumnDef: ColumnDef<Features, MangaChapterWithUrl> = getEditColumnDef();
const deleteColumnDef: ColumnDef<Features, MangaChapterWithUrl> = getDeleteColumnDef();

const TitleCell = ({ row }: CellContext<Features, MangaChapterWithUrl, string>) => (
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageSize: DEFAULT_PAGE_SIZE,
    pageIndex: 0,
  });

  const { enqueueSnackbar } = useSnackbar();
  const confirm = useConfirm();
  const { data: services } = useQuery(getServicesQueryOptions);

  const {
    data,
    isFetching: loading,
    refetch,
  } = useQuery({
    ...getChaptersQueryOptions(
      mangaId,
      pagination,
      sorting as SortBy<MangaChapter>[],
      selectedServices
    ),
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

  const onSaveRow = useCallback((row: Row<Features, MangaChapterWithUrl>) => {
    const state = getRowEditStateFromRow(row);
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    defaultOnSaveRow(row);

    updateChapter({ chapterId: row.original.chapterId, data: state })
      .then(handleResponse)
      .catch(err => {
        enqueueSnackbar(err.message, { variant: 'error' });
      });
  }, [handleResponse, enqueueSnackbar]);

  const onRowDelete = useCallback((row: Row<Features, MangaChapterWithUrl>) => {
    const id = row.original.chapterId;

    deleteChapter(id)
      .then(handleResponse)
      .catch(err => {
        enqueueSnackbar(err.message, { variant: 'error' });
      })
      .finally(refetch);
  }, [handleResponse, enqueueSnackbar, refetch]);

  const columns = useMemo<ColumnDef<Features, MangaChapterWithUrl>[]>(() => columnHelper.columns([
    ...(editable
      ? [editColumnDef]
      : []),

    columnHelper.accessor('chapterNumber', {
      header: 'Ch.',
      enableEditing: false,
      meta: {
        width: '50px',
      },
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

    ...(editable
      ? [deleteColumnDef]
      : []),
  ]), [services, editable]);

  const table = useTable({
    columns,
    data: chapters,
    features,
    rowCount: count,
    state: {
      pagination,
      sorting,
    },
    confirm,
    handleDeleteRowConfirmed: onRowDelete,
    onSaveRowEdit: onSaveRow,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    manualSorting: true,
    manualPagination: true,
    getRowId,
  },
  state => ({
    pagination: state.pagination,
    sorting: state.sorting,
  }));

  return (
    <TableContainer component={Paper}>
      <ServiceFilter
        serviceMangaData={serviceMangaData}
        onChange={setSelectedServices}
      />
      <MaterialTable
        table={table}
        rowCount={count}
        loading={loading}
        ariaLabel='Manga chapters'
        sx={{ minWidth: '600px' }}
      />
    </TableContainer>
  );
}
export default ChapterList;
