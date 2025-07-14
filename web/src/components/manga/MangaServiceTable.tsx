import React, { type FunctionComponent, useCallback, useMemo } from 'react';
import { Checkbox, Paper, SxProps, TableContainer } from '@mui/material';
import { type QueryFunctionContext, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { SelectElement, TextFieldElement } from 'react-hook-form-mui';

import type { MangaService, MangaServiceCreateData } from '@/types/api/manga';
import type { ServiceForApi } from '@/types/api/services';
import type { MangaId } from '@/types/dbTypes';
import type { SelectOption } from '@/types/utility';
import { QueryKeys } from '@/webUtils/constants';
import { defaultDateFormat } from '@/webUtils/utilities';


import {
  createMangaService,
  getMangaServices,
  updateMangaService,
} from '../../api/admin/manga';
import { getServices } from '../../api/services';
import {
  AddRowFormTemplate,
  defaultOnSaveRow,
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '../MaterialTable';
import type { DialogComponentProps } from '../MaterialTable/TableToolbar';
import type {
  MaterialCellContext,
  MaterialColumnDef,
  MaterialTableState,
} from '../MaterialTable/types';
import { createColumnHelper } from '../MaterialTable/utilities';

export type MangaServiceTableProps = {
  mangaId: MangaId
  sx?: SxProps
};

type MangaServiceForm = MangaServiceCreateData & {
  serviceId: string
};

const columnHelper = createColumnHelper<MangaService>();

const initialState: Partial<MaterialTableState<MangaService>> = {
  sorting: [
    { id: 'serviceId', desc: false },
  ],
};

export const MangaServiceTable: FunctionComponent<MangaServiceTableProps> = props => {
  const {
    mangaId,
    sx,
  } = props;

  const { data: mangaServices, isFetching: mangaLoading, refetch } = useQuery({
    queryKey: [QueryKeys.MangaServices, mangaId],
    queryFn: (ctx: QueryFunctionContext<[string, MangaId]>) => getMangaServices(ctx.queryKey[1]),
    initialData: [],
  });
  const { data: services, isFetching: servicesLoading } = useQuery<ServiceForApi[], unknown, Record<number, ServiceForApi>>({
    queryKey: QueryKeys.Services,
    queryFn: getServices,
    select: data => data.reduce((prev, service) => ({ ...prev, [service.serviceId]: service }), {}),
    initialData: [],
  });

  const loading = mangaLoading || servicesLoading;
  const { enqueueSnackbar } = useSnackbar();

  const onSaveRow = useCallback((state: Partial<MangaService>, ctx: MaterialCellContext<MangaService, unknown>) => {
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    const { row } = ctx;
    defaultOnSaveRow(state, ctx);

    updateMangaService(row.original.mangaId, row.original.serviceId, state)
      .then(() => enqueueSnackbar('Updated manga service', { variant: 'success' }))
      .catch(e => enqueueSnackbar(`'Failed to update manga service. ${e}`, { variant: 'error' }));
  }, [enqueueSnackbar]);

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
      EditCell: ctx => (
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
      EditCell: ctx => (
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
    const options: SelectOption[] = Object
      .values(services)
      .map(s => ({
        label: s.name,
        value: s.serviceId,
        disabled: mangaServices.some(ms => ms.serviceId === s.serviceId),
      }));

    return [
      <SelectElement
        name='serviceId'
        key='serviceId'
        label='Service'
        valueKey='value'
        options={options}
        required
        sx={{ width: '100%' }}
        fullWidth
      />,
      <TextFieldElement
        name='titleId'
        key='titleId'
        label='Title id'
        required
        fullWidth
      />,
      <TextFieldElement
        name='feedUrl'
        key='feedUrl'
        label='Feed URL'
        fullWidth
      />,
    ];
  }, [services, mangaServices]);

  const onCreateRow = useCallback((form: MangaServiceForm) => {
    return createMangaService(mangaId, form.serviceId, form)
      .then(() => refetch())
      .then(() => {
        enqueueSnackbar(
          'Successfully create a new manga service',
          { variant: 'success' }
        );
      })
      .catch(err => enqueueSnackbar(err.message, { variant: 'error' }));
  }, [mangaId, refetch, enqueueSnackbar]);

  // The component is memoized with useMemo. I don't see a problem.
  // eslint-disable-next-line react/no-unstable-nested-components
  const CreateDialog = useMemo(() => ({ open, onClose }: DialogComponentProps) => (
    <AddRowFormTemplate
      fields={fields}
      onSuccess={onCreateRow}
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

