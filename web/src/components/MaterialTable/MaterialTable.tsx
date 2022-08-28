import { ConfirmProvider, useConfirm } from 'material-ui-confirm';
import React, {
  ComponentType,
  PropsWithChildren,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortDirection,
  SortingState,
  TableOptions,
  useReactTable,
} from '@tanstack/react-table';
import {
  CircularProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import { darken, styled } from '@mui/material/styles';
import PropTypes from 'prop-types';

import { noop } from '@/webUtils/utilities';

import TablePaginationActions from './TablePaginationActions';
import {
  DialogComponentProps,
  TableToolbar,
  TableToolbarProps,
} from './TableToolbar';
import type {
  MaterialCellContext,
  MaterialColumnDef,
  MaterialTableInstance,
  MaterialTableState,
} from './types';
import {
  defaultSetEditingRow,
  useEditable,
  useEditColumn,
} from './useEditable';

const PREFIX = 'MaterialTable';
const classes = {
  editCell: `${PREFIX}-editCell`,
} as const;



const TableHeadStyled = styled(TableHead)(({ theme }) => ({
  backgroundColor: darken(theme.palette.background.paper, 0.01),
}));

const PaginationContainer = styled('div')({
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
});

const Root = styled('div')({
  [`& .${classes.editCell}`]: {
    display: 'flex',
    justifyContent: 'center',
  },
});

const skeletonCount = new Array(10).fill(0);


export type MaterialTableProps<TData> = {
  title?: string
  data: TData[]
  columns: MaterialColumnDef<TData>[]
  sortable?: boolean
  editable?: boolean
  deletable?: boolean
  creatable?: boolean
  pagination?: boolean
  rowsPerPage?: number
  onSaveRow?: (modifiedData: Partial<TData>, ctx: MaterialCellContext<TData, unknown>) => void
  onDeleteRow?: (ctx: MaterialCellContext<TData, unknown>) => void
  id?: string
  fetchData?: (pageIndex: number, pageSize: number, sortBy?: SortingState) => any
  /* Number of rows in a paginated table and number of skeleton rows while loading */
  rowCount?: number
  loading?: boolean
  CreateDialog?: ComponentType<DialogComponentProps>
  toolbarProps?: TableToolbarProps
  tableOptions?: Partial<TableOptions<TData>>
  initialState?: Partial<MaterialTableState<TData>>
}

/**
 * Renders a table with data generated by react-table with custom hooks
 */
const MaterialTable = <TData, >(props: MaterialTableProps<TData>): ReactElement => {
  const {
    title,
    columns,
    data,
    sortable = false,
    editable = false,
    deletable = false,
    creatable = false,
    pagination = false,
    rowsPerPage: rowsPerPageInitial = 25,
    onSaveRow,
    onDeleteRow,
    id,
    fetchData,
    rowCount = 0,
    loading = false,
    CreateDialog,
    toolbarProps,
    tableOptions = {},
    initialState = {},
  } = props;

  if (data === null || data === undefined) {
    throw new TypeError('Data not given to table');
  }

  const [rowsPerPage] = useState(rowsPerPageInitial);
  const confirm = useConfirm();

  const actualColumns = useEditColumn(columns);

  const tableOriginal = useReactTable({
    columns: (actualColumns as ColumnDef<TData>[]),
    data,
    enableSorting: sortable,
    meta: {
      enableDeleting: deletable,
      enableEditing: editable,
      enableCreating: creatable,
      classes,
      onSaveRow,
      onDeleteRow,
      confirm,
      setEditingRow: defaultSetEditingRow,
      onCancelRow: noop,
    },
    initialState: {
      pagination: {
        pageSize: rowsPerPage,
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      editing: {},
      rowEditState: {},
      ...initialState,
    },
    manualPagination: true,
    pageCount: -1, // This is handled by the TablePagination component
    manualSorting: typeof fetchData === 'function',

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),

    ...tableOptions,
  });

  const table = useEditable(tableOriginal as MaterialTableInstance<TData>);

  const {
    pagination: { pageIndex, pageSize },
    sorting,
  } = table.getState();

  useEffect(() => {
    if (typeof fetchData !== 'function') return;

    fetchData(pageIndex, pageSize, sorting);
  }, [fetchData, pageIndex, pageSize, sorting]);

  const skeletonArray = useMemo(() => {
    if (rowCount > 0) return new Array(rowCount).fill(0);

    return skeletonCount;
  }, [rowCount]);

  const onChangePage = useCallback((e, page) => {
    table.setPageIndex(page);
  }, [table]);
  const onChangePageSize = useCallback((e) => table.setPageSize(e.target.value), [table]);
  const labelDisplayedRows = useCallback(
    ({ page }) => `Page ${page+1} of ${Math.ceil(rowCount/pageSize)}`, [pageSize, rowCount]
  );

  return (
    <Root id={id}>
      <TableToolbar
        title={title}
        DialogComponent={CreateDialog}
        creatable={creatable}
        {...toolbarProps}
      />
      <Table
        aria-label={title}
      >
        <colgroup>
          {table.getVisibleFlatColumns().map((col) => <col width={col.columnDef.width} key={col.id} />)}
        </colgroup>
        <TableHeadStyled>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableCell
                  key={header.id}
                  colSpan={header.colSpan}
                  sortDirection={header.column.getIsSorted() ?
                    header.column.getIsSorted() as SortDirection :
                    undefined}
                >
                  {header.column.getCanSort()? (
                    <TableSortLabel
                      active={header.column.getIsSorted() !== false}
                      direction={(header.column.getIsSorted() || 'desc') as SortDirection}
                      hideSortIcon={!sortable}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableSortLabel>
                  ) : flexRender(header.column.columnDef.header, header.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHeadStyled>
        <TableBody aria-live='polite'>
          {loading && !table.getRowModel().rows.length && skeletonArray.map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <TableRow key={i} aria-hidden>
              {table.getHeaderGroups()[0].headers.map((h) => (
                <TableCell key={h.id} sx={{ fontSize: '1.2rem' }}>
                  <Skeleton />
                </TableCell>
              ))}
            </TableRow>
          ))}
          {table.getRowModel().rows.map(row => {
            return (
              <TableRow key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    padding={cell.column.columnDef.padding}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {pagination && (
        <PaginationContainer>
          {loading && <CircularProgress size={30} aria-label='Loading icon' />}
          <TablePagination
            component='nav'
            count={rowCount}
            page={pageIndex}
            rowsPerPage={pageSize}
            onPageChange={onChangePage}
            onRowsPerPageChange={onChangePageSize}
            ActionsComponent={TablePaginationActions}
            labelDisplayedRows={labelDisplayedRows}
            aria-label='Table pagination'
          />
        </PaginationContainer>
      )}
    </Root>
  );
};

const propTypes = {
  title: PropTypes.string,
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  columns: PropTypes.arrayOf(PropTypes.object).isRequired,
  sortable: PropTypes.bool,
  editable: PropTypes.bool,
  deletable: PropTypes.bool,
  creatable: PropTypes.bool,
  pagination: PropTypes.bool,
  rowsPerPage: PropTypes.number,
  onSaveRow: PropTypes.func,
  onDeleteRow: PropTypes.func,
  id: PropTypes.string,
  fetchData: PropTypes.func,
  rowCount: PropTypes.number,
  loading: PropTypes.bool,
  CreateDialog: PropTypes.func,
  toolbarProps: PropTypes.object,
  hooks: PropTypes.arrayOf(PropTypes.func),
  tableOptions: PropTypes.object,
};

const MaterialTableWrapper = <TData, >(props: PropsWithChildren<MaterialTableProps<TData>>): ReactElement => (
  <ConfirmProvider>
    <MaterialTable {...props} />
  </ConfirmProvider>
);

MaterialTableWrapper.propTypes = propTypes;
MaterialTable.propTypes = propTypes;

export { MaterialTableWrapper as MaterialTable };