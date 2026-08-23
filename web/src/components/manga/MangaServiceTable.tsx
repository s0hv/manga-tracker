import React, { type FunctionComponent, useCallback, useMemo } from 'react';
import { Checkbox, Paper, SxProps, TableContainer } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  type Row,
  type TableState,
  ColumnDef,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useSnackbar } from 'notistack';
import { SelectElement, TextFieldElement } from 'react-hook-form-mui';

import {
  createMangaService,
  getMangaServicesQueryOptions,
  updateMangaService,
} from '#web/api/admin/manga';
import { getServicesQueryOptions } from '#web/api/services';
import {
  defaultOnSaveRow,
  getEditColumnDef,
  getRowEditStateFromRow,
  rowEditingPlugin,
} from '@/components/MaterialTable/plugins';
import type { MangaService, MangaServiceCreateData } from '@/types/api/manga';
import type { MangaId } from '@/types/dbTypes';
import type { SelectOption } from '@/types/utility';
import { noRows } from '@/webUtils/constants';
import { defaultDateFormat } from '@/webUtils/utilities';

import {
  AddRowFormTemplate,
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '../MaterialTable';
import type { DialogComponentProps } from '../MaterialTable/TableToolbar';


export type MangaServiceTableProps = {
  mangaId: MangaId
  sx?: SxProps
};

type MangaServiceForm = MangaServiceCreateData & {
  serviceId: string
};

const features = tableFeatures({
  rowEditingPlugin,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    basic: sortFn_basic,
    text: sortFn_text,
  },
});
type Features = typeof features;

const columnHelper = createColumnHelper<Features, MangaService>();

const initialState: Partial<TableState<Features>> = {
  sorting: [
    {
      id: 'serviceId' satisfies keyof MangaService,
      desc: false,
    },
  ],
};

export const MangaServiceTable: FunctionComponent<MangaServiceTableProps> = props => {
  const {
    mangaId,
    sx,
  } = props;

  const { data: mangaServices, isFetching: mangaLoading, refetch } = useQuery(getMangaServicesQueryOptions(mangaId));
  const { data: services, isFetching: servicesLoading } = useQuery(getServicesQueryOptions);

  const loading = mangaLoading || servicesLoading;
  const { enqueueSnackbar } = useSnackbar();

  const onSaveRow = useCallback((row: Row<Features, MangaService>) => {
    const state = getRowEditStateFromRow(row);
    const keys = Object.keys(state);
    if (keys.length === 0) return;

    defaultOnSaveRow(row);

    updateMangaService(row.original.mangaId, row.original.serviceId, state)
      .then(() => enqueueSnackbar('Updated manga service', { variant: 'success' }))
      .catch(e => enqueueSnackbar(`'Failed to update manga service. ${e}`, { variant: 'error' }));
  }, [enqueueSnackbar]);

  const columns = useMemo((): ColumnDef<Features, MangaService>[] => columnHelper.columns([
    getEditColumnDef(),

    columnHelper.accessor('serviceId', {
      header: 'Service',
      sortFn: 'text',
      cell: ({ getValue }) => services?.[getValue()]?.name || null,
      enableEditing: false,
    }),

    columnHelper.accessor('disabled', {
      header: 'Disabled',
      sortFn: 'basic',
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
      sortFn: 'text',
      enableEditing: false,
    }),

    columnHelper.accessor('lastCheck', {
      header: 'Last check',
      sortFn: sortFn_datetime,
      enableEditing: false,
      cell: ({ getValue }) => defaultDateFormat(getValue()),
    }),

    columnHelper.accessor('nextUpdate', {
      header: 'Next update',
      sortFn: sortFn_datetime,
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
  ]), [services]);

  // Table layout
  const fields = useMemo(() => {
    const options: SelectOption[] = Object
      .values(services ?? {})
      .map(s => ({
        label: s.name,
        value: s.serviceId,
        disabled: mangaServices?.some(ms => ms.serviceId === s.serviceId),
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
    const {
      serviceId,
      ...data
    } = form;

    return createMangaService(mangaId, form.serviceId, data)
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

  const table = useTable({
    data: mangaServices ?? noRows,
    columns,
    features,
    initialState,
    onSaveRowEdit: onSaveRow,
  },
  () => null);

  return (
    <TableContainer component={Paper} sx={sx}>
      <MaterialTable
        table={table}
        title='Manga services'
        toolbarProps={{ addButtonLabel: 'create manga service' }}
        rowCount={mangaServices?.length || 3}
        loading={loading}
        CreateDialog={CreateDialog}
        enableRowCreation
      />
    </TableContainer>
  );
};

