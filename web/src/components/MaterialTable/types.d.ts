import type {
  Cell,
  CellContext,
  Column,
  ColumnDef,
  ColumnDefTemplate,
  Row,
  RowData,
  RowModel,
  Table,
  TableState,
} from '@tanstack/react-table';
import type { TableCellProps } from '@mui/material';
import { useConfirm } from 'material-ui-confirm';

// eslint-disable-next-line import/export, @typescript-eslint/no-empty-interface
export interface MaterialCellContext<TData extends RowData, TValue> extends Omit<
  CellContext<TData, TValue>,
  | 'table'
  | 'column'
  | 'cell'
> {
}

export type MaterialColumnDef<TData extends RowData, TValue = unknown> = Omit<
  ColumnDef<TData, TValue>,
  | 'cell'
> & {
  enableEditing?: boolean
  padding?: TableCellProps['padding']
  cell?: ColumnDefTemplate<MaterialCellContext<TData, TValue>>
  EditCell?: ColumnDefTemplate<MaterialCellContext<TData, TValue>>
  OriginalCell?: ColumnDefTemplate<MaterialCellContext<TData, TValue>>
  width?: number | string
}

export type MaterialColumn<TData extends RowData, TValue> = Omit<
  Column<TData, TValue>,
  | 'columnDef'
> & {
  columnDef: MaterialColumnDef<TData, TValue>
}

export type MaterialCell<TData extends RowData, TValue> = Omit<
  Cell<TData, TValue>,
  | 'column'
  | 'getContext'
> & {
  column: MaterialColumn<TData, TValue>
  getContext: () => MaterialCellContext<TData, TValue>
}

export type MaterialRow<TData extends RowData> = Omit<
  Row<TData>,
  | 'getVisibleCells'
  | 'getAllCells'
> & {
  getVisibleCells: () => MaterialCell<TData, unknown>[]
  getAllCells: () => MaterialCell<TData, unknown>[]
}

export type MaterialRowModel<TData extends RowData> = Omit<
  RowModel<TData>,
  | 'rows'
  | 'flatRows'
  | 'rowsById'
> & {
    rows: MaterialRow<TData>[];
    flatRows: MaterialRow<TData>[];
    rowsById: Record<string, MaterialRow<TData>>;
}

export type MaterialTableState<TData extends RowData> = TableState & {
  editing: Record<string, boolean>;
  rowEditState: Record<string, TData | undefined>
}

export type MaterialTableInstance<TData extends RowData> = Omit<
  Table<TData>,
  | 'getRowModel'
  | 'getState'
  | 'getVisibleFlatColumns'
> & {
  getRowModel: () => MaterialRowModel<TData>
  getState: () => MaterialTableState<TData>
  getVisibleFlatColumns: () => MaterialColumn<TData, unknown>[]
}

// eslint-disable-next-line import/export
export interface MaterialCellContext<TData extends RowData, TValue> extends Omit<
  CellContext<TData, TValue>,
  | 'table'
  | 'column'
  | 'cell'
> {
  table: MaterialTableInstance<TData>
  column: MaterialColumn<TData, TValue>
  cell: MaterialCell<TData, TValue>
}


export type AfterRowEdit<TData extends RowData> = (modifiedData: Partial<TData>, ctx: MaterialCellContext<TData, unknown>) => void
export type RowChangeAction<TData extends RowData> = (ctx: MaterialCellContext<TData, unknown>) => void

declare module '@tanstack/table-core' {
  interface TableMeta<TData extends RowData> {
    enableEditing: boolean
    enableDeleting: boolean
    enableCreating: boolean
    classes?: Record<string, string>
    onSaveRow?: AfterRowEdit<TData>
    onCancelRow?: AfterRowEdit<TData>
    onDeleteRow?: RowChangeAction<TData>
    onEditRow?: RowChangeAction<TData>
    confirm: ReturnType<typeof useConfirm>

    setEditingRow?: (ctx: MaterialCellContext<TData, unknown>, isEditing: boolean) => void
  }
}
