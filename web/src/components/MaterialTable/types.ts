import type { TableCellProps } from '@mui/material';
import type {
  CellData,
  Row,
  RowData,
  TableFeature,
  TableFeatures,
} from '@tanstack/react-table';
import type { confirm } from 'material-ui-confirm';

import type {
  Row_RowDeleting,
  Table_RowDeleting,
  TableOptions_RowDeleting,
} from './plugins/rowDeletingPlugin';
import type {
  ColumnDef_RowEditing,
  Row_RowEditing,
  Table_RowEditing,
  TableOptions_RowEditing,
  TableState_RowEditing,
} from './plugins/rowEditingPlugin';

export type { WithRequiredFeature } from './plugins/types';


export type TableAPI<TTable> = {
  [K in keyof TTable as K extends string ? `table_${K}` : never]: {
    fn: TTable[K]
  }
};

export type RowPrototype<TRow> = {
  [K in keyof TRow as K extends string ? `row_${K}` : never]: {
    fn: NonNullable<TRow[K]> extends (...args: infer P) => infer R
      ? (
        row: Row<TableFeatures, RowData>,
        ...rest: P
      ) => R
      : never
  }
};

/* eslint-disable @typescript-eslint/no-unused-vars */
declare module '@tanstack/react-table' {
  interface Plugins {
    rowEditingPlugin: TableFeature
    rowDeletingPlugin: TableFeature
  }

  interface TableState_FeatureMap {
    rowEditingPlugin: TableState_RowEditing
  }

  interface TableOptions_FeatureMap<
    TFeatures extends TableFeatures,
    TData extends RowData
  > {
    rowEditingPlugin: TableOptions_RowEditing<TFeatures, TData>
    rowDeletingPlugin: TableOptions_RowDeleting<TFeatures, TData>
  }

  interface Table_FeatureMap<
    TFeatures extends TableFeatures,
    TData extends RowData
  > {
    rowEditingPlugin: Table_RowEditing<TFeatures, TData>
    rowDeletingPlugin: Table_RowDeleting<TFeatures, TData>
  }

  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData
  > {
    rowEditingPlugin: ColumnDef_RowEditing<TFeatures, TData, TValue>
  }

  interface Row_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData
  > {
    rowEditingPlugin: Row_RowEditing
    rowDeletingPlugin: Row_RowDeleting
  }

  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData
  > {
    padding?: TableCellProps['padding']
    width?: CSSStyleProperties['width'] | number
    minWidth?: CSSStyleProperties['minWidth'] | number
  }

  interface TableMeta<
    TFeatures extends TableFeatures,
    TData extends RowData
  > {
    classes?: Record<string, string>
    confirm: typeof confirm
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
