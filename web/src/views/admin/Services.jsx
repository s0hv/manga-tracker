import { useSnackbar } from 'notistack';
import React, { useCallback } from 'react';
import { Checkbox, Container, Paper, TableContainer } from '@mui/material';
import { format, formatDistanceToNowStrict } from 'date-fns';
import enLocale from 'date-fns/locale/en-GB';

import {
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '../../components/MaterialTable';
import { useCSRF } from '../../utils/csrf';
import { editService } from '../../api/admin/service';

function Services(props) {
  const {
    services = [],
  } = props;

  const { enqueueSnackbar } = useSnackbar();
  const csrf = useCSRF();

  // Format date strings back to dates for sorting
  const data = React.useMemo(() => {
    services.forEach(service => {
      service.lastCheck = service.lastCheck ? new Date(service.lastCheck) : undefined;
      service.nextUpdate = service.nextUpdate ? new Date(service.nextUpdate) : undefined;
    });
    return services;
  },
  [services]);

  const columns = React.useMemo(() => [
    { Header: 'Id', accessor: 'id', canEdit: false },
    { Header: 'Name', accessor: 'serviceName' },
    {
      Header: 'Last checked',
      accessor: 'lastCheck',
      canEdit: false,
      sortType: 'datetime',
      Cell: ({ row }) => (row.values.lastCheck ?
        `${format(row.values.lastCheck, 'MMM do, HH:mm', { locale: enLocale })} - ${formatDistanceToNowStrict(row.values.lastCheck, { addSuffix: true })}` :
        'Never'),
    },
    {
      Header: 'Next update',
      accessor: 'nextUpdate',
      sortType: 'basic',
      Cell: ({ row }) => (row.values.nextUpdate ?
        `${format(row.values.nextUpdate, 'MMM do, HH:mm', { locale: enLocale })} - ${formatDistanceToNowStrict(row.values.nextUpdate, { addSuffix: true })}` :
        'ASAP'),
      EditCell: ({ row, state, cell }) => (
        <EditableDateTimePicker
          variant='inline'
          ampm={false}
          value={row.values.nextUpdate}
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

  const onSaveRow = useCallback((row, state) => {
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    keys.forEach(key => {
      row.values[key] = state[key];
    });

    const body = {
      service: {
        serviceName: state.serviceName,
        lastCheck: state.lastCheck,
        disabled: state.disabled,
      },
      serviceWhole: {
        nextUpdate: state.nextUpdate,
      },
    };

    editService(csrf, row.original.id, body)
      .then(() => {
        enqueueSnackbar('Service edited successfully', { variant: 'success' });
      })
      .catch(err => enqueueSnackbar(err.message, { variant: 'error' }));
  }, [csrf, enqueueSnackbar]);

  return (
    <Container maxWidth='lg' style={{ minWidth: '950px' }}>
      <TableContainer component={Paper}>
        <MaterialTable
          title='Services'
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
