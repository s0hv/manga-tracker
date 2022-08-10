import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link, Paper, TableContainer } from '@mui/material';
import { useSnackbar } from 'notistack';
import type { SortingState, TableOptions } from '@tanstack/react-table';
import { useCSRF } from '../utils/csrf';

import { defaultOnSaveRow, MaterialTable } from './MaterialTable';
import { defaultDateFormat } from '../utils/utilities';
import {
  deleteChapter,
  getChapters,
  SortBy,
  updateChapter,
} from '../api/chapter';
import { formatChapterUrl } from '../utils/formatting';
import { createColumnHelper } from './MaterialTable/utilities';
import type { MangaChapter } from '@/types/api/chapter';
import type {
  AfterRowEdit,
  MaterialCellContext,
  MaterialColumnDef,
  RowChangeAction,
} from './MaterialTable/types';
import type { MangaId } from '@/types/dbTypes';


interface MangaChapterWithUrl extends MangaChapter {
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

export type ServiceMangaData = {
  urlFormat: string
  titleId: string
}

export type ChapterListProps = {
  chapters?: MangaChapterWithUrl[]
  editable?: boolean
  serviceMangaData?: Record<number, ServiceMangaData>
  mangaId: MangaId
}

function ChapterList(props: ChapterListProps): ReactElement {
  const {
    chapters: initialChapters,
    editable = false,
    serviceMangaData,
    mangaId,
  } = props;

  const [chapters, setChapters] = useState<MangaChapterWithUrl[]>(initialChapters || []);
  const [count, setCount] = useState<number>(initialChapters?.length || 0);
  const [loading, setLoading] = useState<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();
  const csrf = useCSRF();

  useEffect(() => setChapters(initialChapters || []), [initialChapters]);

  const formatChapters = useCallback<(chapters: MangaChapter[]) => MangaChapterWithUrl[]>((chs) => {
    if (!chs) return [];

    return chs.map(chapter => {
      const newChapter = { ...chapter } as MangaChapterWithUrl;

      if (!serviceMangaData) return newChapter;

      const mangaData = serviceMangaData[chapter.serviceId];
      if (mangaData) {
        newChapter.url = formatChapterUrl(mangaData.urlFormat, chapter.chapterIdentifier, mangaData.titleId);
      }

      return newChapter;
    });
  }, [serviceMangaData]);

  const handleResponse = useCallback((json) => {
    enqueueSnackbar(json.message, { variant: 'success' });
  }, [enqueueSnackbar]);

  const onSaveRow = useCallback<AfterRowEdit<MangaChapterWithUrl>>((state, ctx) => {
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    defaultOnSaveRow(state, ctx);

    updateChapter(csrf, ctx.row.original.chapterId, state)
      .then(handleResponse)
      .catch(err => {
        enqueueSnackbar(err.message, { variant: 'error' });
      });
  }, [csrf, handleResponse, enqueueSnackbar]);

  const onDeleteRow = useCallback<RowChangeAction<MangaChapterWithUrl>>(({ row }) => {
    const id = row.original.chapterId;
    setChapters(chapters.filter(c => c.chapterId !== id));

    deleteChapter(csrf, id)
      .then(handleResponse)
      .catch(err => {
        enqueueSnackbar(err.message, { variant: 'error' });
      });
  }, [chapters, csrf, handleResponse, enqueueSnackbar]);

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
  ], []);

  const getRowId = useCallback<(row: MangaChapterWithUrl) => string>((row) => row.chapterId.toString(), []);

  const fetchData = useCallback((pageIndex: number, pageSize: number, sortBy?: SortingState) => {
    setLoading(true);
    const offset = pageIndex*pageSize;

    getChapters(mangaId, pageSize, offset, sortBy as SortBy<MangaChapter>[])
      .then(json => {
        setChapters(formatChapters(json.chapters || []));
        setCount(Number(json.count) || 0);
      })
      .finally(() => setLoading(false));
  }, [formatChapters, mangaId]);

  const [tableOptions] = useState<Partial<TableOptions<MangaChapterWithUrl>>>({ getRowId });

  return (
    <TableContainer component={Paper}>
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
      />
    </TableContainer>
  );
}
export default ChapterList;
