import { useSnackbar } from 'notistack';
import React from 'react';
import { Checkbox, Container, Paper, TableContainer } from '@material-ui/core';
import { format, formatDistanceToNowStrict } from 'date-fns';
import enLocale from 'date-fns/locale/en-GB';

import {
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '../../components/MaterialTable';
import { csrfHeader } from '../../utils/csrf';

function Services(props) {
  const {
    services = [],
    _csrf: csrf,
  } = props;

  const { enqueueSnackbar } = useSnackbar();

  // Format date strings back to dates for sorting
  const data = React.useMemo(() => {
    services.forEach(service => {
      service.last_check = service.last_check ? new Date(service.last_check) : undefined;
      service.next_update = service.next_update ? new Date(service.next_update) : undefined;
    });
    return services;
  },
  [services]);

  const columns = React.useMemo(() => [
    { Header: 'Id', accessor: 'id', canEdit: false },
    { Header: 'Name', accessor: 'service_name' },
    {
      Header: 'Last checked',
      accessor: 'last_check',
      canEdit: false,
      sortType: 'datetime',
      Cell: ({ row }) => (row.values.last_check ?
        `${format(row.values.last_check, 'MMM do, HH:mm', { locale: enLocale })} - ${formatDistanceToNowStrict(row.values.last_check, { addSuffix: true })}` :
        'Never'),
    },
    {
      Header: 'Next update',
      accessor: 'next_update',
      sortType: 'basic',
      Cell: ({ row }) => (row.values.next_update ?
        `${format(row.values.next_update, 'MMM do, HH:mm', { locale: enLocale })} - ${formatDistanceToNowStrict(row.values.next_update, { addSuffix: true })}` :
        'ASAP'),
      EditCell: ({ row, state, cell }) => (
        <EditableDateTimePicker
          clearable
          variant='inline'
          ampm={false}
          value={row.values.next_update}
          onError={console.log}
          row={row}
          state={state}
          cell={cell}
        />
      ),
    },
    {
      Header: 'Disabled',
      accessor: 'disabled',
      widthSuggestion: '1%',
      sortType: 'basic',
      Cell: ({ row }) => <Checkbox checked={row.values.disabled} disabled />,
      EditCell: ({ row, state, cell }) => (
        <EditableCheckbox
          checked={row.values.disabled}
          row={row}
          state={state}
          cell={cell}
        />
      ),
    },
  ],
  []);

  const onSaveRow = (row, state) => {
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    keys.forEach(key => {
      row.values[key] = state[key];
    });

    fetch('/api/admin/editService', {
      method: 'post',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...csrfHeader(csrf),
      },
      body: JSON.stringify({ ...state, service_id: row.original.id }),
    })
      .then(res => {
        if (res.status === 200) {
          enqueueSnackbar('Service edited successfully', { variant: 'success' });
        } else {
          enqueueSnackbar(
            `Failed to edit service. Server responded with ${res.status}`,
            { variant: 'error' }
          );
        }
      })
      .catch(err => enqueueSnackbar(err.message, { variant: 'error' }));
  };

  return (
    <Container maxWidth='lg' style={{ minWidth: '950px' }}>
      <TableContainer component={Paper}>
        <MaterialTable
          columns={columns}
          data={data}
          sortable
          editable
          onSaveRow={onSaveRow}
        />
      </TableContainer>
    </Container>
  );
}

export default Services;
