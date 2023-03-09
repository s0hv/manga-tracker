import type { RowData } from '@tanstack/react-table';
import { useConfirm } from 'material-ui-confirm';
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
    confirm: ReturnType<typeof useConfirm>

    setEditingRow?: (ctx: MaterialCellContext<TData, unknown>, isEditing: boolean) => void
  }
}
