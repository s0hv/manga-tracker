import React, { useCallback, useMemo, useState } from 'react';
import {
  Link,
  Paper,
  TableContainer,
} from '@material-ui/core';

import { MaterialTable } from './MaterialTable';
import { defaultDateFormat } from '../utils/utilities';
import Alert from './Alert';


function ChapterList(props) {
  const {
    chapters: initialChapters,
    editable = false,
  } = props;

  const [chapters, setChapters] = useState(initialChapters);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState(undefined);
  const [alertOpen, setAlertOpen] = useState(false);

  const handleResponse = useCallback((r) => {
    r.json()
      .then(json => {
        setMessage(json.message || json.error);
        setError(!!json.error);
        setAlertOpen(true);
      })
      .catch(err => {
        if (r.status !== 200) {
          setError(true);
          setMessage(`${r.status} ${r.statusText}`);
        } else {
          console.error(err);
          setError(true);
          setMessage(err.message);
        }
        setAlertOpen(true);
      });
  }, []);

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

  return (
    <>
      <TableContainer component={Paper}>
        <MaterialTable
          columns={columns}
          data={chapters}
          onSaveRow={onSaveRow}
          onDeleteRow={onDeleteRow}
          sortable
          editable={editable}
          deletable={editable}
        />
      </TableContainer>
      <Alert
        open={alertOpen}
        setOpen={setAlertOpen}
        severity={error ? 'error' : 'success'}
      >
        {message}
      </Alert>
    </>
  );
}
export default ChapterList;
