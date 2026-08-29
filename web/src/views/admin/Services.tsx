import React, { ReactElement, useCallback } from 'react';
import { Checkbox, Container, Paper, TableContainer } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import {
  type ColumnDef,
  type Row,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { useSnackbar } from 'notistack';

import { editServiceMutationOptions } from '#web/api/admin/service';
import {
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '@/components/MaterialTable';
import {
  defaultOnSaveRow,
  getEditColumnDef,
  getRowEditStateFromRow,
  rowEditingPlugin,
} from '@/components/MaterialTable/plugins';
import type {
  ServiceForAdmin,
  ServiceForAdminSerialized,
} from '@/types/api/services';


const features = tableFeatures({
  rowEditingPlugin,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
type Features = typeof features;

const columnHelper = createColumnHelper<Features, ServiceForAdmin>();

export type ServicesProps = {
  services?: ServiceForAdmin[] | ServiceForAdminSerialized[]
};

function Services(props: ServicesProps): ReactElement {
  const {
    services = [],
  } = props;

  const { enqueueSnackbar } = useSnackbar();
  const editService = useMutation(editServiceMutationOptions);

  // Format date strings back to dates for sorting
  const data = React.useMemo((): ServiceForAdmin[] => {
    services.forEach(service => {
      service.lastCheck = service.lastCheck ? new Date(service.lastCheck) : undefined;
      service.nextUpdate = service.nextUpdate ? new Date(service.nextUpdate) : undefined;
    });
    return services as ServiceForAdmin[];
  },
  [services]);

  const columns = React.useMemo((): ColumnDef<Features, ServiceForAdmin>[] => columnHelper.columns([
    getEditColumnDef(),

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
      sortFn: sortFn_datetime,
      cell: ({ row }) => (row.original.lastCheck
        ? `${format(row.original.lastCheck, 'MMM do, HH:mm', { locale: enGB })} - ${formatDistanceToNowStrict(row.original.lastCheck, { addSuffix: true })}`
        : 'Never'),
    }),

    columnHelper.accessor('nextUpdate', {
      header: 'Next update',
      sortFn: sortFn_datetime,
      cell: ({ row }) => (row.original.nextUpdate
        ? `${format(row.original.nextUpdate, 'MMM do, HH:mm', { locale: enGB })} - ${formatDistanceToNowStrict(row.original.nextUpdate, { addSuffix: true })}`
        : 'ASAP'),
      EditCell: ctx => (
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
      sortFn: sortFn_basic,
      cell: ({ row }) => <Checkbox checked={row.original.disabled} disabled />,
      EditCell: ctx => (
        <EditableCheckbox
          checked={ctx.row.original.disabled}
          aria-label='disabled'
          ctx={ctx}
        />
      ),
    }),
  ]),
  []);

  const onSaveRow = useCallback((
    row: Row<Features, ServiceForAdmin>
  ) => {
    const state = getRowEditStateFromRow(row);
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    defaultOnSaveRow(row);

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

    editService.mutateAsync({ serviceId: row.original.id, body })
      .then(() => {
        enqueueSnackbar('Service edited successfully', { variant: 'success' });
      })
      .catch(err => enqueueSnackbar(err.message, { variant: 'error' }));
  }, [enqueueSnackbar, editService]);

  const table = useTable({
    columns,
    features,
    data,
    onSaveRowEdit: onSaveRow,
  },
  state => ({
    sorting: state.sorting,
  }));

  return (
    <Container maxWidth='lg' style={{ minWidth: '950px' }}>
      <TableContainer component={Paper}>
        <MaterialTable
          title='Services'
          table={table}
        />
      </TableContainer>
    </Container>
  );
}

export default Services;
