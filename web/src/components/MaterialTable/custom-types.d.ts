import type { RowData } from '@tanstack/react-table';
import { confirm } from 'material-ui-confirm';

import type {
  AfterRowEdit,
  RowChangeAction,
} from '@/components/MaterialTable/types';

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
    confirm: typeof confirm

    setEditingRow?: (ctx: MaterialCellContext<TData, unknown>, isEditing: boolean) => void
  }
}
