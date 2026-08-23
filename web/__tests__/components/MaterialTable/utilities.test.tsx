import {
  createColumnHelper, rowPaginationFeature, tableFeatures, useTable,
} from '@tanstack/react-table';
import { renderHook } from '@testing-library/react';
import { type Mock, describe, expect, it, vi } from 'vitest';

import {
  doIfColumnFeatureExists,
  doIfRowFeatureExists,
  doIfTableFeatureExists,
} from '@/components/MaterialTable/utilities';

interface TestData {
  id: string
  name: string
}

const data: TestData[] = [
  { id: '1', name: 'test1' },
];

const withFeatures = tableFeatures({
  rowPaginationFeature,
});
const withoutFeatures = tableFeatures({});
type WithFeatures = typeof withFeatures;
type WithoutFeatures = typeof withoutFeatures;

const columnHelperWithFeatures = createColumnHelper<WithFeatures, TestData>();
const columnHelperWithoutFeatures = createColumnHelper<WithoutFeatures, TestData>();

const columnsWithFeatures = columnHelperWithFeatures.columns([
  columnHelperWithFeatures.accessor('id', {
    header: 'ID',
  }),

  columnHelperWithFeatures.accessor('name', {
    header: 'Name',
  }),
]);

const columnsWithoutFeatures = columnHelperWithoutFeatures.columns([
  columnHelperWithoutFeatures.accessor('id', {
    header: 'ID',
  }),

  columnHelperWithoutFeatures.accessor('name', {
    header: 'Name',
  }),
]);

const useTableWithFeatures = () => useTable({
  features: withFeatures,
  columns: columnsWithFeatures,
  data,
});

const useTableWithoutFeatures = () => useTable({
  features: withoutFeatures,
  columns: columnsWithoutFeatures,
  data,
});

const renderTableWithFeaturesHook = () => renderHook(() => useTableWithFeatures()).result.current;
const renderTableWithoutFeaturesHook = () => renderHook(() => useTableWithoutFeatures()).result.current;

/**
 * Shared test bodies for the `doIf*FeatureExists` helpers. `runWithFeature` and `runWithoutFeature`
 * are expected to invoke the helper under test with a table/column/row that does and does not have
 * the feature, respectively, forwarding the given callbacks.
 */
function testDoIfFeatureExists(
  runWithFeature: (onExists: Mock, onNotExists: Mock) => void,
  runWithoutFeature: (onExists: Mock, onNotExists: Mock) => void
) {
  it('should call correct function when feature exists', () => {
    const featureExistsFn = vi.fn();
    const featureDoesNotExistFn = vi.fn();

    runWithFeature(featureExistsFn, featureDoesNotExistFn);

    expect(featureExistsFn).toHaveBeenCalledOnce();
    expect(featureDoesNotExistFn).not.toHaveBeenCalled();
  });

  it('should call correct function when feature does not exist', () => {
    const featureExistsFn = vi.fn();
    const featureDoesNotExistFn = vi.fn();

    runWithoutFeature(featureExistsFn, featureDoesNotExistFn);

    expect(featureExistsFn).not.toHaveBeenCalled();
    expect(featureDoesNotExistFn).toHaveBeenCalledOnce();
  });
}

describe('doIfColumnFeatureExists', () => {
  testDoIfFeatureExists(
    (onExists, onNotExists) => {
      const table = renderTableWithFeaturesHook();
      doIfColumnFeatureExists('rowPaginationFeature', table.getAllFlatColumns()[0], onExists, onNotExists);
    },
    (onExists, onNotExists) => {
      const table = renderTableWithoutFeaturesHook();
      doIfColumnFeatureExists('rowPaginationFeature', table.getAllFlatColumns()[0], onExists, onNotExists);
    }
  );
});

describe('doIfRowFeatureExists', () => {
  testDoIfFeatureExists(
    (onExists, onNotExists) => {
      const table = renderTableWithFeaturesHook();
      doIfRowFeatureExists('rowPaginationFeature', table.getRowModel().rows[0], onExists, onNotExists);
    },
    (onExists, onNotExists) => {
      const table = renderTableWithoutFeaturesHook();
      doIfRowFeatureExists('rowPaginationFeature', table.getRowModel().rows[0], onExists, onNotExists);
    }
  );
});

describe('doIfTableFeatureExists', () => {
  testDoIfFeatureExists(
    (onExists, onNotExists) => {
      const table = renderTableWithFeaturesHook();
      doIfTableFeatureExists('rowPaginationFeature', table, onExists, onNotExists);
    },
    (onExists, onNotExists) => {
      const table = renderTableWithoutFeaturesHook();
      doIfTableFeatureExists('rowPaginationFeature', table, onExists, onNotExists);
    }
  );
});
