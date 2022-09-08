import React, { type FunctionComponent, useCallback, useMemo } from 'react';
import { Checkbox, Paper, SxProps, TableContainer } from '@mui/material';
import { useSnackbar } from 'notistack';
import { type QueryFunctionContext, useQuery } from '@tanstack/react-query';

import { Select, type SelectData, TextField } from 'mui-rff';
import { useCSRF } from '@/webUtils/csrf';
import {
  AddRowFormTemplate,
  defaultOnSaveRow,
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '../MaterialTable';
import { defaultDateFormat } from '@/webUtils/utilities';
import {
  createMangaService,
  getMangaServices,
  updateMangaService,
} from '../../api/admin/manga';
import { QueryKeys } from '@/webUtils/constants';
import type { MangaId } from '@/types/dbTypes';
import { getServices } from '../../api/services';
import type { MangaService } from '@/types/api/manga';
import type {
  MaterialCellContext,
  MaterialColumnDef,
  MaterialTableState,
} from '../MaterialTable/types';
import { createColumnHelper } from '../MaterialTable/utilities';
import type { ServiceForApi } from '@/types/api/services';
import type { DialogComponentProps } from '../MaterialTable/TableToolbar';

export type MangaServiceTableProps = {
  mangaId: MangaId
  sx?: SxProps
}

const columnHelper = createColumnHelper<MangaService>();

const initialState: Partial<MaterialTableState<MangaService>> = {
  sorting: [
    { id: 'serviceId', desc: false },
  ],
};

export const MangaServiceTable: FunctionComponent<MangaServiceTableProps> = (props) => {
  const {
    mangaId,
    sx,
  } = props;

  const { data: mangaServices, isFetching: mangaLoading, refetch } = useQuery([QueryKeys.MangaServices, mangaId],
    { queryFn: (ctx: QueryFunctionContext<[string, MangaId]>) => getMangaServices(ctx.queryKey[1]), initialData: []});
  const { data: services, isFetching: servicesLoading } = useQuery<ServiceForApi[], unknown, Record<number, ServiceForApi>>(QueryKeys.Services,
    {
      queryFn: getServices,
      select: data => data.reduce((prev, service) => ({ ...prev, [service.serviceId]: service }), {}),
      initialData: [],
    });

  const loading = mangaLoading || servicesLoading;
  const { enqueueSnackbar } = useSnackbar();
  const csrf = useCSRF();

  const onSaveRow = useCallback((state: Partial<MangaService>, ctx: MaterialCellContext<MangaService, unknown>) => {
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    const { row } = ctx;
    defaultOnSaveRow(state, ctx);

    updateMangaService(csrf, row.original.mangaId, row.original.serviceId, state)
      .then(() => enqueueSnackbar('Updated manga service', { variant: 'success' }))
      .catch((e) => enqueueSnackbar(`'Failed to update manga service. ${e}`, { variant: 'error' }));
  }, [csrf, enqueueSnackbar]);

  const columns = useMemo((): MaterialColumnDef<MangaService, any>[] => [
    columnHelper.accessor('serviceId', {
      header: 'Service',
      cell: ({ getValue }) => services[getValue()]?.name || null,
      enableEditing: false,
    }),
    columnHelper.accessor('disabled', {
      header: 'Disabled',
      sortingFn: 'basic',
      cell: ({ getValue }) => <Checkbox checked={getValue()} disabled />,
      EditCell: (ctx) => (
        <EditableCheckbox
          checked={ctx.cell.getValue()}
          aria-label='Disabled'
          ctx={ctx}
        />
      ),
    }),
    columnHelper.accessor('titleId', {
      header: 'Title id',
      enableEditing: false,
    }),
    columnHelper.accessor('lastCheck', {
      header: 'Last check',
      sortingFn: 'datetime',
      enableEditing: false,
      cell: ({ getValue }) => defaultDateFormat(getValue()),
    }),
    columnHelper.accessor('nextUpdate', {
      header: 'Next update',
      sortingFn: 'datetime',
      cell: ({ getValue }) => defaultDateFormat(getValue()),
      EditCell: (ctx) => (
        <EditableDateTimePicker
          value={ctx.row.original.nextUpdate}
          label='Next update'
          ampm={false}
          ctx={ctx}
        />
      ),
    }),
  ], [services]);

  // Table layout
  const fields = useMemo(() => {
    const data: SelectData[] = Object
      .values(services)
      .map(s => ({
        label: s.name,
        value: s.serviceId,
        disabled: mangaServices.some(ms => ms.serviceId === s.serviceId),
      }));

    return [
      <Select
        name='serviceId'
        key='serviceId'
        label='Service'
        SelectDisplayProps={{ 'aria-label': 'Service select' }}
        data={data}
        required
      />,
      <TextField
        name='titleId'
        key='titleId'
        label='Title id'
        required
      />,
      <TextField
        name='feedUrl'
        key='feedUrl'
        label='Feed URL'
      />,
    ];
  }, [services, mangaServices]);

  const onCreateRow = useCallback((form: any) => {
    return createMangaService(csrf, mangaId, form.serviceId, form)
      .then(() => refetch())
      .then(() => {
        enqueueSnackbar(
          'Successfully create a new manga service',
          { variant: 'success' }
        );
      })
      .catch(err => enqueueSnackbar(err.message, { variant: 'error' }));
  }, [csrf, mangaId, refetch, enqueueSnackbar]);

  // The component is memoized with useMemo. I don't see a problem
  // eslint-disable-next-line react/no-unstable-nested-components
  const CreateDialog = useMemo(() => ({ open, onClose }: DialogComponentProps) => (
    <AddRowFormTemplate
      fields={fields}
      onSubmit={onCreateRow}
      onClose={onClose}
      open={open}
    />
  ), [fields, onCreateRow]);

  return (
    <TableContainer component={Paper} sx={sx}>
      <MaterialTable
        title='Manga services'
        columns={columns}
        data={loading ? [] : mangaServices}
        onSaveRow={onSaveRow}
        rowCount={mangaServices?.length || 3}
        loading={loading}
        initialState={initialState}
        CreateDialog={CreateDialog}
        creatable
        sortable
        editable
      />
    </TableContainer>
  );
};

