import React from 'react';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { IconButton, Input } from '@mui/material';
import {
  type Cell,
  type CellContext,
  type CellData,
  type ColumnDef,
  type ColumnDefTemplate,
  type OnChangeFn,
  type Row,
  type RowData,
  type Table,
  type TableFeatures,
  type Updater,
  assignPrototypeAPIs,
  assignTableAPIs,
  makeStateUpdater,
  Subscribe,
  TableFeature,
} from '@tanstack/react-table';

import { noop } from '@/webUtils/utilities';

import { COLUMN_IDS, CSS_CLASSES } from '../constants';
import type { RowPrototype, TableAPI, WithRequiredFeature } from '../types';
import { makeStateUpdaterGeneric } from '../utilities';

export type TableFeaturesWithRowEditing = WithRequiredFeature<'rowEditingPlugin'>;

type RowEditState<TData extends Record<string, any>> = Record<string, TData | undefined>;

export interface TableState_RowEditing {
  rowEditing: Record<string, boolean>
  rowEditState: RowEditState<Partial<Record<string, any>>>
}

export interface TableOptions_RowEditing<
  in out TFeatures extends TableFeatures,
  in out TData extends RowData
> {
  onRowEditingChange?: OnChangeFn<Record<string, boolean>>
  onRowEditStateChange?: OnChangeFn<RowEditState<TData>>
  rowEditColumnClass?: string
  onSaveRowEdit?: (row: Row<TFeatures, TData>) => unknown
  onCancelRowEdit?: (row: Row<TFeatures, TData>) => unknown
}

// Define types for our new feature's table APIs
export interface Table_RowEditing<
  TFeatures extends TableFeatures,
  TData extends RowData
> {
  setRowEditable: (updater: Updater<RowEditState<TData>>) => void
  saveRow: (row: Row<TFeatures, TData>) => unknown
}

export interface ColumnDef_RowEditing<
  in out TFeatures extends TableFeatures,
  in out TData extends RowData,
  TValue extends CellData = CellData
> {
  /**
   * Enables/Disables editing for this column
   */
  enableEditing?: boolean

  /**
   * Renders the cell when the row is in edit mode
   */
  EditCell?: ColumnDefTemplate<CellContext<TFeatures, TData, TValue>>
}

export interface Row_RowEditing {
  startEditing: () => void
  cancelEditing: () => void
  saveEdits: () => void
}

export function getEditColumnDef<
  TFeatures extends TableFeaturesWithRowEditing,
  TData extends RowData
>(): ColumnDef<TFeatures, TData> {
  const columnDef: ColumnDef<TableFeaturesWithRowEditing, TData> = {
    id: COLUMN_IDS.edit,
    meta: {
      padding: 'checkbox',
    },
    enableEditing: false,
    enableSorting: false,
    header: () => null,
    cell: function Cell(ctx) {
      const {
        table,
        row,
      } = ctx;
      const rowEditColumnClass = table.options.rowEditColumnClass;

      return (
        <div className={rowEditColumnClass}>
          <Subscribe
            source={table.atoms.rowEditing}
            selector={rowEditing => rowEditing[row.id]}
          >
            {isRowEditing => !isRowEditing
              ? (
                <IconButton
                  onClick={() => row.startEditing()}
                  name='edit'
                  aria-label='edit row'
                  size='large'
                >
                  <EditIcon />
                </IconButton>
              )
              : (
                <>
                  <IconButton
                    name='save'
                    onClick={() => row.saveEdits()}
                    aria-label='save row'
                    size='large'
                  >
                    <SaveIcon />
                  </IconButton>
                  <IconButton
                    name='cancel'
                    onClick={() => row.cancelEditing()}
                    aria-label='cancel edit'
                    size='large'
                  >
                    <CancelIcon />
                  </IconButton>
                </>
              )}
          </Subscribe>
        </div>
      );
    },
  };

  // Didn't find a way to get this to work with TS
  return columnDef as ColumnDef<TFeatures, TData>;
}


export const rowEditingPlugin: TableFeature = {
  getInitialState: initialState => ({
    rowEditing: {},
    rowEditState: {},
    ...initialState,
  }),

  getDefaultTableOptions: table => ({
    onRowEditingChange: makeStateUpdaterGeneric('rowEditing', table),
    onRowEditStateChange: makeStateUpdaterGeneric('rowEditState', table),
    onSaveRowEdit: row => defaultOnSaveRow(
      row as Row<TableFeaturesWithRowEditing, RowData>
    ),
    onCancelRowEdit: noop,
    rowEditColumnClass: CSS_CLASSES.editCell,
  }),

  getDefaultColumnDef<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData
  >() {
    const defaultColumnDef: ColumnDef_RowEditing<TableFeaturesWithRowEditing, TData, TValue> = {
      EditCell: DefaultEditCell,
    };

    return defaultColumnDef as ColumnDef<TFeatures, TData, TValue>;
  },

  constructTableAPIs: <TFeatures extends TableFeatures, TData extends RowData>(
    table_: Table<TFeatures, TData>
  ) => {
    const table = table_ as Table<TableFeaturesWithRowEditing, TData>;

    assignTableAPIs('rowEditingPlugin', table, {
      table_setRowEditable: {
        fn(updater) {
          table.options.onRowEditStateChange?.(updater);
        },
      },

      table_saveRow: {
        fn(row) {
          const { table } = row;
          const {
            onSaveRowEdit = (defaultOnSaveRow as unknown as (row: Row<TFeatures, TData>) => unknown),
          } = table.options as TableOptions_RowEditing<TFeatures, TData>;

          // First, run the callback that handles reading values from the editing state
          onSaveRowEdit(row);
          // Then, we can disable the row editing and clear its state
          defaultSetEditingRow(row, false);
        },
      },
    } satisfies TableAPI<Table_RowEditing<TFeatures, TData>>);
  },

  assignRowPrototype: <TFeatures extends TableFeatures, TData extends RowData>(
    prototype: Record<string, any>,
    table: Table<TFeatures, TData>
  ) => {
    assignPrototypeAPIs('rowEditingPlugin', prototype, table, {
      row_startEditing: {
        fn(row) {
          const rowEditingState = row.table.atoms.rowEditing.get();
          const currentState = rowEditingState[row.id];

          if (currentState) {
            return;
          }

          defaultSetEditingRow(row, true);
        },
      },

      row_cancelEditing: {
        fn(row) {
          const rowEditingState = row.table.atoms.rowEditing.get();
          const currentState = rowEditingState[row.id];

          if (!currentState) {
            return;
          }

          defaultSetEditingRow(row, false);
          row.table.options.onCancelRowEdit?.(row);
        },
      },

      row_saveEdits: {
        fn(row) {
          const rowEditingState = row.table.atoms.rowEditing.get();
          const currentState = rowEditingState[row.id];

          if (!currentState) {
            return;
          }

          row.table.saveRow(row);
        },
      },
    } satisfies RowPrototype<Row_RowEditing>);
  },
};

export function getRowEditStateFromRow<
  TFeatures extends TableFeaturesWithRowEditing,
  TData extends RowData
>(
  row: Row<TFeatures, TData>
): Partial<TData> {
  return (
    (row as Row<TableFeaturesWithRowEditing, TData>).table.atoms.rowEditState.get()[row.id] as Partial<TData>
  ) ?? {};
}

/**
 * Default implementation of the row save action.
 * Will update current row values to the edited ones.
 * @param row The row generated by react table
 */
export function defaultOnSaveRow<
  TFeatures extends TableFeaturesWithRowEditing,
  TData extends RowData
>(
  row: Row<TFeatures, TData>
) {
  const state = getRowEditStateFromRow(row);

  Object.keys(state).forEach(key => {
    const k = key as keyof TData;
    // This will change the original data passed on to the component.
    // Since this works well enough currently, it can be left as is.
    row.original[k] = state[k] as TData[typeof k];
    // Why was this required again? It is some internal state of react-table
    row._valuesCache[k as string] = state[k];
  });
}

/**
 * Simple function that sets the row edit state after a cell has been edited
 * @param newValue The new value for that cell
 * @param cell current cell that was edited
 */
export function processCellEdit<
  TFeatures extends TableFeaturesWithRowEditing,
  TData extends Record<string, any>,
  TValue
>(
  newValue: TValue,
  cell: Cell<TFeatures, TData, TValue>
): void {
  const rowStates = (
    cell.table as Table<TableFeaturesWithRowEditing, TData>
  ).atoms.rowEditState.get();

  const rowState = rowStates[cell.row.id];

  if (!rowState) return;

  rowState[cell.column.id] = newValue;
}

export function DefaultEditCell<
  TFeatures extends TableFeaturesWithRowEditing,
  TData extends RowData,
  TValue extends CellData = CellData
>(
  { column, getValue, cell }: CellContext<TFeatures, TData, TValue>
): React.ReactElement {
  let name = column.columnDef.header;
  if (typeof name !== 'string') {
    name = column.id;
  }
  return (
    <Input
      defaultValue={getValue()}
      onChange={(event => processCellEdit(
        event.target.value as TValue,
        cell
      ))}
      sx={{ width: '100%' }}
      inputProps={{
        'aria-label': `${name} input`,
      }}
    />
  );
}

export const defaultSetEditingRow = <
  TFeatures extends TableFeatures,
  TData extends RowData
>(
  row: Row<TFeatures, TData>,
  isEditing: boolean
) => {
  const updater = makeStateUpdater('rowEditing', row.table);
  updater(editing => ({
    ...editing,
    [row.id]: isEditing,
  }));

  const rowStateUpdater = makeStateUpdater('rowEditState', row.table);

  rowStateUpdater(rowEditState => (isEditing
    ? {
      ...rowEditState,
      [row.id]: {},
    }
    : {
      ...rowEditState,
      [row.id]: undefined,
    }));
};
