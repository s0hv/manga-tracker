import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link,
  Paper,
  TableContainer,
} from '@material-ui/core';
import { useSnackbar } from 'notistack';

import { MaterialTable } from './MaterialTable';
import { defaultDateFormat } from '../utils/utilities';


function ChapterList(props) {
  const {
    chapters: initialChapters,
    editable = false,
    serviceUrlFormats,
    mangaId,
  } = props;

  const [chapters, setChapters] = useState(initialChapters);
  const [count, setCount] = useState(initialChapters?.length || 0);
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => setChapters(initialChapters), [initialChapters]);

  const formatChapters = useCallback((chs) => {
    if (!chs) return [];

    return chs.map(chapter => {
      const newChapter = { ...chapter };
      newChapter.release_date = new Date(chapter.release_date * 1000);

      const urlFormat = serviceUrlFormats && serviceUrlFormats[chapter.service_id];
      if (urlFormat) {
        newChapter.url = urlFormat.replace('{}', chapter.chapter_url);
      }

      return newChapter;
    });
  }, [serviceUrlFormats]);

  const handleResponse = useCallback((r) => {
    r.json()
      .then(json => {
        enqueueSnackbar(json.message || json.error, {
          variant: json.error ? 'error' : 'success',
        });
      })
      .catch(err => {
        if (r.status !== 200) {
          enqueueSnackbar(`${r.status} ${r.statusText}`, { variant: 'error' });
        } else {
          console.error(err);
          enqueueSnackbar(err.message, { variant: 'error' });
        }
      });
  }, [enqueueSnackbar]);

  const onSaveRow = useCallback((row, state) => {
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    keys.forEach(key => {
      row.values[key] = state[key];
    });

    fetch(`/api/chapter/${row.original.chapter_id}`, {
      method: 'post',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state),
    })
      .then(handleResponse);
  }, [handleResponse]);

  const onDeleteRow = useCallback((row) => {
    const id = row.original.chapter_id;
    setChapters(chapters.filter(c => c.chapter_id !== id));

    fetch(`/api/chapter/${row.original.chapter_id}`, {
      method: 'delete',
      credentials: 'same-origin',
    })
      .then(handleResponse);
  }, [chapters, handleResponse]);

  const columns = useMemo(() => [
    {
      Header: 'Title',
      accessor: 'title',
      Cell: ({ row }) => (
        <Link href={row.original.url} target='_blank' style={{ textDecoration: 'none' }} rel='noopener noreferrer'>
          <span>
            {row.values.title}
          </span>
        </Link>
      ),
    },
    { Header: 'Chapter', accessor: 'chapter_number' },
    {
      Header: 'Released',
      accessor: 'release_date',
      canEdit: false,
      sortType: 'datetime',
      Cell: ({ row }) => defaultDateFormat(row.values.release_date),
    },
    { Header: 'Group', accessor: 'group' },
  ], []);

  const fetchData = useCallback((pageIndex, pageSize) => {
    setLoading(true);
    const offset = pageIndex*pageSize;

    fetch(`/api/manga/${mangaId}/chapters?limit=${pageSize}&offset=${offset}`)
      .then(res => res.json())
      .then(json => {
        setChapters(formatChapters(json.chapters || []));
        setCount(json.count || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [formatChapters, mangaId]);

  return (
    <>
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
        />
      </TableContainer>
    </>
  );
}
export default ChapterList;
