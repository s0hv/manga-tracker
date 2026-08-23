import React from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import { IconButton } from '@mui/material';
import {
  type ColumnDef,
  type Row,
  type RowData,
  type Table,
  type TableFeature,
  type TableFeatures,
  assignPrototypeAPIs,
  assignTableAPIs,
} from '@tanstack/react-table';
import type { confirm } from 'material-ui-confirm';

import { noop } from '@/webUtils/utilities';

import { COLUMN_IDS } from '../constants';
import type { RowPrototype, TableAPI, WithRequiredFeature } from '../types';
import { doIfRowFeatureExists } from '../utilities';

export type TableFeaturesWithRowDeleting = WithRequiredFeature<'rowDeletingPlugin'>;

export interface TableOptions_RowDeleting<
  in out TFeatures extends TableFeatures,
  in out TData extends RowData
> {
  confirm: typeof confirm
  onRowDelete?: (row: Row<TFeatures, TData>) => unknown
  handleDeleteRowConfirmed?: (row: Row<TFeatures, TData>) => unknown
}

export interface Table_RowDeleting<
  TFeatures extends TableFeatures,
  TData extends RowData
> {
  deleteRow: (row: Row<TFeatures, TData>) => unknown
}

export interface Row_RowDeleting {
  delete: () => void
}

export function getDeleteColumnDef<
  TFeatures extends TableFeaturesWithRowDeleting,
  TData extends RowData
>(): ColumnDef<TFeatures, TData> {
  const columnDef: ColumnDef<TableFeaturesWithRowDeleting, TData> = {
    id: COLUMN_IDS.delete,
    meta: {
      padding: 'checkbox',
    },
    enableEditing: false,
    header: () => null,
    cell: function Cell(ctx) {
      return (
        <IconButton
          name='delete'
          onClick={() => ctx.row.delete()}
          aria-label='Delete row'
          size='large'
        >
          <DeleteIcon />
        </IconButton>
      );
    },
  };

  return columnDef as ColumnDef<TFeatures, TData>;
}

export const rowDeletingPlugin: TableFeature = {
  getDefaultTableOptions: () => ({
    onRowDelete: row => defaultOnRowDelete(
      row as Row<TableFeaturesWithRowDeleting, RowData>
    ),
    handleDeleteRowConfirmed: noop,
  }),

  constructTableAPIs: <TFeatures extends TableFeatures, TData extends RowData>(
    table_: Table<TFeatures, TData>
  ) => {
    const table = table_ as Table<TableFeaturesWithRowDeleting, TData>;

    assignTableAPIs('rowDeletingPlugin', table, {
      table_deleteRow: {
        fn: function (row) {
          row.table.options.onRowDelete?.(row);
        },
      },
    } satisfies TableAPI<Table_RowDeleting<TableFeaturesWithRowDeleting, TData>>);
  },

  assignRowPrototype: <TFeatures extends TableFeatures, TData extends RowData>(
    prototype: Record<string, any>,
    table: Table<TFeatures, TData>
  ) => {
    assignPrototypeAPIs('rowDeletingPlugin', prototype, table, {
      row_delete: {
        fn: function (row) {
          row.table.deleteRow(row);
        },
      },
    } satisfies RowPrototype<Row_RowDeleting>);
  },
};

export function defaultOnRowDelete<
  TFeatures extends TableFeaturesWithRowDeleting,
  TData extends RowData
>(row: Row<TFeatures, TData>) {
  const rowTyped = row as Row<TableFeaturesWithRowDeleting, TData>;
  const { table } = rowTyped;

  const {
    confirm,
    handleDeleteRowConfirmed = noop,
  } = table.options;

  confirm({
    description: (
      <span style={{ whiteSpace: 'pre-wrap' }}>
        Do you want to delete row:
        <br />
        {`${JSON.stringify(row.original, undefined, 2)}`}
      </span>
    ),
    confirmationText: 'Delete',
    confirmationButtonProps: { 'aria-label': 'Confirm delete row' },
  })
    .then(reason => {
      if (reason.confirmed) {
        doIfRowFeatureExists(
          'rowEditingPlugin',
          row,
          row => row.cancelEditing()
        );

        handleDeleteRowConfirmed(rowTyped);
      }
    });
}
