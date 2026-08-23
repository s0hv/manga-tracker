import React from 'react';
import { Checkbox } from '@mui/material';
import {
  type ColumnDef,
  type RowData,
  type TableFeatures,
  type TableOptions,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { TableState } from '@tanstack/table-core';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { describe, expect, it, test, vi } from 'vitest';

import { mockUTCDates, withRoot } from '../../utils';
import {
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '@/components/MaterialTable';
import type {
  MaterialTableProps,
} from '@/components/MaterialTable/MaterialTable';
import {
  defaultOnSaveRow,
  getDeleteColumnDef,
  getEditColumnDef,
  rowDeletingPlugin,
  rowEditingPlugin,
} from '@/components/MaterialTable/plugins';
import { defaultDateFormat } from '@/webUtils/utilities';

import { defaultDateFormatRegex } from '../../constants';


fetchMock.config.overwriteRoutes = true;

type TestData = {
  id: string
  editableString: string
  editableTime: Date | null | undefined
  editableCheckbox: boolean
};

const sortFns = {
  alphanumeric: sortFn_alphanumeric,
  text: sortFn_text,
  datetime: sortFn_datetime,
  basic: sortFn_basic,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const testFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowEditingPlugin,
  sortFns,
});
type Features = typeof testFeatures;

const columnHelper = createColumnHelper<Features, TestData>();

const testColumns = columnHelper.columns([
  columnHelper.accessor('id', {
    header: 'ID',
    enableEditing: false,
  }),

  columnHelper.accessor('editableString', {
    header: 'Editable string',
  }),

  columnHelper.accessor('editableTime', {
    header: 'Editable time',
    sortFn: 'datetime',
    cell: ({ row }) => defaultDateFormat(row.original.editableTime),
    EditCell: ctx => (
      <EditableDateTimePicker
        ampm={false}
        value={ctx.row.original.editableTime}
        ctx={ctx}
      />
    ),
  }),

  columnHelper.accessor('editableCheckbox', {
    header: 'Editable checkbox',
    sortFn: 'basic',
    cell: ({ row }) => <Checkbox checked={row.original.editableCheckbox} disabled />,
    EditCell: ctx => (
      <EditableCheckbox
        checked={ctx.row.original.editableCheckbox}
        ctx={ctx}
      />
    ),
  }),
]) as unknown as ColumnDef<TableFeatures, RowData>[];

const testColumnsWithEdit = [
  getEditColumnDef(),
  ...testColumns,
] as unknown as ColumnDef<TableFeatures, RowData>[];

function createRow(id: string, editableString: string, editableTime: Date, editableCheckbox: boolean): TestData {
  return {
    id,
    editableString,
    editableTime,
    editableCheckbox,
  };
}

const getData = () => [
  createRow('unique_id1', 'test string', new Date('2020-07-15T15:51:17.885Z'), false),
  createRow('unique_id2', 'test string 2', new Date('2019-07-15T15:51:17.885Z'), true),
  createRow('unique_id3', 'test string 3', new Date('2020-09-15T15:51:17.885Z'), false),
];

interface RootProps<
  TFeatures extends TableFeatures,
  TData extends RowData
> extends Omit<MaterialTableProps<TFeatures, TData, TableState<TFeatures>>, 'table'> {
  data: TData[]
  columns: ColumnDef<TFeatures, TData>[]
  features: TFeatures
  tableOptions?: Omit<TableOptions<TFeatures, TData>, 'features' | 'data' | 'columns'>
}

const Root = <TFeatures extends TableFeatures, TData extends RowData>({
  data,
  columns,
  features,
  tableOptions,
  ...materialTableProps
}: RootProps<TFeatures, TData>) => {
  const table = useTable({
    columns,
    features,
    data,
    ...tableOptions,
  } as unknown as TableOptions<TFeatures, TData>);

  return (
    <MaterialTable
      table={table}
      {...materialTableProps}
    />
  );
};

function createWrapper<
  TFeatures extends TableFeatures,
  TData extends RowData
>(props: RootProps<TFeatures, TData>) {
  render(
    withRoot(
      <Root {...props} />
    )
  );
};

describe('It should render correctly', () => {
  mockUTCDates();

  const expectNoLoadingElements = () => {
    expect(screen.queryByLabelText(/loading icon/i)).not.toBeInTheDocument();
  };

  const expectNoEditElements = () => {
    expect(screen.queryByRole('button', { name: /edit row/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete row/i })).not.toBeInTheDocument();
  };

  const expectEditElementsExist = () => {
    expect(screen.getAllByRole('button', { name: /edit row/i })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /delete row/i })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /add item/i })).toBeTruthy();
  };

  const expectHeadersExist = (headers = testColumns) => {
    headers.forEach(col => {
      expect(screen.getByRole('columnheader', { name: col.header as string })).toBeInTheDocument();
    });
  };

  test('without data', () => {
    render(
      <Root
        data={[]}
        features={tableFeatures({})}
        columns={testColumns}
      />
    );

    // Only header row should exist
    expect(screen.getAllByRole('row')).toHaveLength(1);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    expectNoLoadingElements();
    expectNoEditElements();
    expectHeadersExist();
  });

  test('with data', () => {
    const data = getData();

    render(
      <Root
        data={data}
        features={tableFeatures({
          rowEditingPlugin,
          rowDeletingPlugin,
          rowSortingFeature,
          rowPaginationFeature,
          sortedRowModel: createSortedRowModel(),
          paginatedRowModel: createPaginatedRowModel(),
          sortFns,
        })}
        columns={[
          getEditColumnDef() as ColumnDef<TableFeatures, RowData>,
          getDeleteColumnDef() as ColumnDef<TableFeatures, RowData>,
          ...testColumns,
        ]}
        enableRowCreation
        CreateDialog={() => null}
      />
    );

    // Make sure sort buttons exist
    testColumns.forEach(col => {
      expect(screen.getByRole('button', { name: col.header as string })).toBeInTheDocument();
    });

    // Data rows + header row
    expect(screen.getAllByRole('row')).toHaveLength(data.length + 1);

    expectNoLoadingElements();

    expectEditElementsExist();

    screen.getAllByRole('row')
      .slice(1)
      .forEach((rowElem, idx) => {
        const row = within(rowElem);
        const values = data[idx];

        expect(row.getByRole('cell', { name: values.id })).toBeInTheDocument();
        expect(row.getByRole('cell', { name: values.editableString })).toBeInTheDocument();
        expect(row.getByRole('cell', { name: new RegExp(defaultDateFormatRegex, 'i') })).toBeInTheDocument();
        expect(row.getByRole('checkbox', { checked: values.editableCheckbox })).toBeInTheDocument();
      });

    // Test pagination element
    const pagination = within(screen.getByRole('navigation', { name: /table pagination/i }));

    expect(pagination.getByRole('button', { name: /first page/i })).toBeInTheDocument();
    expect(pagination.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
    expect(pagination.getByRole('button', { name: /next page/i })).toBeInTheDocument();
    expect(pagination.getByRole('button', { name: /last page/i })).toBeInTheDocument();
  });

  test('when loading with existing rows', () => {
    const data = getData();
    render(
      <Root
        data={data}
        features={tableFeatures({
          rowPaginationFeature,
          paginatedRowModel: createPaginatedRowModel(),
        })}
        columns={testColumns}
        loading
      />
    );

    expect(screen.getByRole('progressbar', { name: /loading icon/i })).toBeInTheDocument();
    // No skeletons should be visible
    expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(data.length + 1);
  });

  test('when loading without existing rows', () => {
    render(
      <Root
        data={[]}
        features={tableFeatures({
          rowPaginationFeature,
        })}
        columns={testColumns}
        loading
      />
    );

    expect(screen.getByRole('progressbar', { name: /loading icon/i })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1);

    // Skeletons should be rendered
    expect(screen.getAllByRole('row', { hidden: true }).length).toBeGreaterThan(1);
  });
});

describe('Should handle editing', () => {
  test('should call save when save clicked', async () => {
    const onSave = vi.fn();

    createWrapper({
      data: getData(),
      features: tableFeatures({
        rowEditingPlugin,
      }),
      columns: testColumnsWithEdit as any,
      tableOptions: {
        onSaveRowEdit: onSave,
      },
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    const user = userEvent.setup();

    await user.click(row.getByRole('button', { name: /edit row/i }));
    await waitFor(() => row.getByRole('button', { name: /save row/i }));

    await user.click(row.getByRole('button', { name: /save row/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /cancel edit/i })).not.toBeInTheDocument();
  });

  it('should not call save when cancel clicked', async () => {
    const onSave = vi.fn();

    createWrapper({
      data: getData(),
      features: tableFeatures({
        rowEditingPlugin,
      }),
      columns: testColumnsWithEdit as any,
      tableOptions: {
        onSaveRowEdit: onSave,
      },
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    const user = userEvent.setup();

    await user.click(row.getByRole('button', { name: /edit row/i }));
    await user.click(row.getByRole('button', { name: /cancel edit/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /save row/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel edit/i })).not.toBeInTheDocument();
  });

  it('should not allow editing non editable columns', async () => {
    const onSave = vi.fn();
    const data = getData();

    createWrapper({
      data: data,
      features: tableFeatures({
        rowEditingPlugin,
      }),
      columns: testColumnsWithEdit as any,
      tableOptions: {
        onSaveRowEdit: onSave,
      },
    });

    expect(testColumns[0].enableEditing).toBeFalse();

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    const user = userEvent.setup();
    await user.click(row.getByRole('button', { name: /edit row/i }));

    const _temp = row.getByText(data[0].id).closest('td');
    expect(_temp).toBeInTheDocument();
    const cell = within(_temp!);
    // Make sure that no input is present
    expect(cell.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('should allow editing string columns', async () => {
    const onSave = vi.fn().mockImplementation(defaultOnSaveRow);

    createWrapper({
      data: getData(),
      features: tableFeatures({
        rowEditingPlugin,
      }),
      columns: testColumnsWithEdit as any,
      tableOptions: {
        onSaveRowEdit: onSave,
      },
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    const user = userEvent.setup();
    await user.click(row.getByRole('button', { name: /edit row/i }));

    // Find input and change its value
    const input = row.getByLabelText(/editable string input/i);

    const newVal = 'value changed';

    await user.clear(input);
    await user.type(input, newVal);
    await user.click(row.getByRole('button', { name: /save row/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(row.getByText(newVal)).toBeInTheDocument();
  });

  it('should allow editing checkbox', async () => {
    const onSave = vi.fn().mockImplementation(defaultOnSaveRow);

    createWrapper({
      data: getData(),
      features: tableFeatures({
        rowEditingPlugin,
      }),
      columns: testColumnsWithEdit as any,
      tableOptions: {
        onSaveRowEdit: onSave,
      },
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    const user = userEvent.setup();
    await user.click(row.getByRole('button', { name: /edit row/i }));

    // Find checkbox and click it to change it's value
    const checkbox = row.getByRole('checkbox', { checked: false });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);

    await user.click(row.getByRole('button', { name: /save row/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(row.getByRole('checkbox')).toBeChecked();
    expect(row.getByRole('checkbox')).toBeDisabled();
  });
});
