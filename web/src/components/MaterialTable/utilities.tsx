import {
  AccessorFn,
  ColumnHelper,
  createColumnHelper as createColumnHelperOriginal,
  DeepKeys,
  DeepValue,
  makeStateUpdater,
  RequiredKeys,
  RowData,
  TableState,
  Updater,
} from '@tanstack/react-table';

import {
  MaterialColumnDef,
  MaterialTableInstance,
  MaterialTableState,
} from './types';

export type MaterialColumnHelper<TData extends RowData> = Omit<
  ColumnHelper<TData>,
  | 'accessor'
  | 'display'
> & {
  accessor: <TAccessor extends AccessorFn<TData> | DeepKeys<TData>, TValue extends TAccessor extends AccessorFn<TData, infer TReturn> ? TReturn : TAccessor extends DeepKeys<TData> ? DeepValue<TData, TAccessor> : never>(accessor: TAccessor, column: Omit<MaterialColumnDef<TData, TValue>, 'accessorKey'>) => MaterialColumnDef<TData, TValue>
  display: (column: RequiredKeys<Omit<MaterialColumnDef<TData, unknown>, 'accessorKey' | 'accessorFn'>, 'id'>) => MaterialColumnDef<TData, unknown>
};
export const createColumnHelper = <TData extends RowData>() => createColumnHelperOriginal<TData>() as MaterialColumnHelper<TData>;


export const makeMaterialStateUpdater = <TData, K extends keyof MaterialTableState<TData>>(key: K, instance: MaterialTableInstance<any>) => {
  return makeStateUpdater(key as keyof TableState, instance) as (updater: Updater<MaterialTableState<TData>[K]>) => void;
};
