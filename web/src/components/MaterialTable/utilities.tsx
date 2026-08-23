import {
  type Column,
  type OnChangeFn,
  type ReactTable,
  type Row,
  type RowData,
  type TableFeatures,
  type TableState,
  type TableState_All,
  makeStateUpdater,
} from '@tanstack/react-table';

import type {
  WithRequiredFeature,
} from './plugins/types';

export function doIfColumnFeatureExists<
  TFeatures extends TableFeatures,
  TFeatureKey extends keyof TableFeatures,
  TReturn,
  TData extends RowData
>(
  feature: TFeatureKey,
  column: Column<TFeatures, TData>,
  featureExists: (column: Column<WithRequiredFeature<TFeatureKey>, TData>) => TReturn,
  featureNotExists: (column: Column<TFeatures, TData>) => TReturn
) {
  if (column.table.options.features[feature]) {
    return featureExists(column as unknown as Column<WithRequiredFeature<TFeatureKey>, TData>);
  }

  return featureNotExists(column);
}

export function doIfRowFeatureExists<
  TFeatures extends TableFeatures,
  TFeatureKey extends keyof TableFeatures,
  TReturn,
  TData extends RowData
>(
  feature: TFeatureKey,
  row: Row<TFeatures, TData>,
  featureExists: (row: Row<WithRequiredFeature<TFeatureKey>, TData>) => TReturn,
  featureNotExists?: (row: Row<TFeatures, TData>) => TReturn
) {
  if (row.table.options.features[feature]) {
    return featureExists(row as unknown as Row<WithRequiredFeature<TFeatureKey>, TData>);
  }

  return featureNotExists?.(row);
}

export function doIfTableFeatureExists<
  TFeatures extends TableFeatures,
  TFeatureKey extends keyof TableFeatures,
  TReturn,
  TData extends RowData,
  TSelect
>(
  feature: TFeatureKey,
  table: ReactTable<TFeatures, TData, TSelect>,
  featureExists: (table: ReactTable<WithRequiredFeature<TFeatureKey>, TData, TSelect>) => TReturn,
  featureNotExists: (table: ReactTable<TFeatures, TData, TSelect>) => TReturn
): TReturn;

export function doIfTableFeatureExists<
  TFeatures extends TableFeatures,
  TFeatureKey extends keyof TableFeatures,
  TReturn,
  TData extends RowData,
  TSelect
>(
  feature: TFeatureKey,
  table: ReactTable<TFeatures, TData, TSelect>,
  featureExists: (table: ReactTable<WithRequiredFeature<TFeatureKey>, TData, TSelect>) => TReturn,
  featureNotExists?: (table: ReactTable<TFeatures, TData, TSelect>) => TReturn
): TReturn | undefined;

export function doIfTableFeatureExists<
  TFeatures extends TableFeatures,
  TFeatureKey extends keyof TableFeatures,
  TReturn,
  TData extends RowData,
  TSelect
>(
  feature: TFeatureKey,
  table: ReactTable<TFeatures, TData, TSelect>,
  featureExists: (table: ReactTable<WithRequiredFeature<TFeatureKey>, TData, TSelect>) => TReturn,
  featureNotExists?: (table: ReactTable<TFeatures, TData, TSelect>) => TReturn
): TReturn | undefined {
  if (table.options.features[feature]) {
    return featureExists(table as unknown as ReactTable<WithRequiredFeature<TFeatureKey>, TData, TSelect>);
  }

  return featureNotExists?.(table);
}

/**
 * Wrapper function to `makeStateUpdater` that works with columns that depend on TData.
 * @param key
 * @param instance
 */
export function makeStateUpdaterGeneric<
  TFeatures extends TableFeatures,
  K extends (string & {}) | keyof TableState_All | keyof TableState<TFeatures>,
  TData extends RowData
>(
  key: K,
  instance: {
    readonly options: { readonly atoms?: object | undefined }
    readonly baseAtoms: object
  }
) {
  return makeStateUpdater(key as string, instance) as OnChangeFn<TData>;
}
