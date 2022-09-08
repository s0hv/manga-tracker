import { useSnackbar } from 'notistack';
import React, { ReactElement, useCallback } from 'react';
import { Checkbox, Container, Paper, TableContainer } from '@mui/material';
import { format, formatDistanceToNowStrict } from 'date-fns';
import enLocale from 'date-fns/locale/en-GB';

import {
  defaultOnSaveRow,
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '../../components/MaterialTable';
import { useCSRF } from '@/webUtils/csrf';
import { editService } from '../../api/admin/service';
import type {
  MaterialCellContext,
  MaterialColumnDef,
} from '@/components/MaterialTable/types';
import type {
  ServiceForAdmin,
  ServiceForAdminSerialized,
} from '@/types/api/services';
import { createColumnHelper } from '@/components/MaterialTable/utilities';

const columnHelper = createColumnHelper<ServiceForAdmin>();

export type ServicesProps = {
  services?: ServiceForAdmin[] | ServiceForAdminSerialized[]
}

function Services(props: ServicesProps): ReactElement {
  const {
    services = [],
  } = props;

  const { enqueueSnackbar } = useSnackbar();
  const csrf = useCSRF();

  // Format date strings back to dates for sorting
  const data = React.useMemo((): ServiceForAdmin[] => {
    services.forEach(service => {
      service.lastCheck = service.lastCheck ? new Date(service.lastCheck) : undefined;
      service.nextUpdate = service.nextUpdate ? new Date(service.nextUpdate) : undefined;
    });
    return services as ServiceForAdmin[];
  },
  [services]);

  const columns = React.useMemo((): MaterialColumnDef<ServiceForAdmin, any>[] => [
    columnHelper.accessor('id', {
      header: 'Id',
      enableEditing: false,
    }),
    columnHelper.accessor('serviceName', {
      header: 'Name',
      enableEditing: false,
    }),
    columnHelper.accessor('lastCheck', {
      header: 'Last checked',
      enableEditing: false,
      sortingFn: 'datetime',
      cell: ({ row }) => (row.original.lastCheck ?
        `${format(row.original.lastCheck, 'MMM do, HH:mm', { locale: enLocale })} - ${formatDistanceToNowStrict(row.original.lastCheck, { addSuffix: true })}` :
        'Never'),
    }),
    columnHelper.accessor('nextUpdate', {
      header: 'Next update',
      sortingFn: 'datetime',
      cell: ({ row }) => (row.original.nextUpdate ?
        `${format(row.original.nextUpdate, 'MMM do, HH:mm', { locale: enLocale })} - ${formatDistanceToNowStrict(row.original.nextUpdate, { addSuffix: true })}` :
        'ASAP'),
      EditCell: (ctx) => (
        <EditableDateTimePicker
          ampm={false}
          value={ctx.row.original.nextUpdate}
          onError={console.log}
          ctx={ctx}
        />
      ),
    }),
    columnHelper.accessor('disabled', {
      header: 'Disabled',
      width: '1%',
      sortingFn: 'basic',
      cell: ({ row }) => <Checkbox checked={row.original.disabled} disabled />,
      EditCell: (ctx) => (
        <EditableCheckbox
          checked={ctx.row.original.disabled}
          aria-label='disabled'
          ctx={ctx as MaterialCellContext<any, boolean>}
        />
      ),
    }),
  ],
  []);

  const onSaveRow = useCallback((state: Partial<ServiceForAdmin>, ctx: MaterialCellContext<ServiceForAdmin, unknown>) => {
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    const { row } = ctx;
    defaultOnSaveRow(state, ctx);

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
