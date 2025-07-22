import React from 'react';
import { Checkbox } from '@mui/material';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { describe, expect, it, test, vi } from 'vitest';

import { mockUTCDates, restoreMocks, silenceConsole, withRoot } from '../utils';
import {
  defaultOnSaveRow,
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '@/components/MaterialTable';
import type {
  MaterialTableProps,
} from '@/components/MaterialTable/MaterialTable';
import { MaterialColumnDef } from '@/components/MaterialTable/types';
import { createColumnHelper } from '@/components/MaterialTable/utilities';
import { defaultDateFormat } from '@/webUtils/utilities';


import { defaultDateFormatRegex } from '../constants';

fetchMock.config.overwriteRoutes = true;

type TestData = {
  id: string
  editableString: string
  editableTime: Date
  editableCheckbox: boolean
};

const columnHelper = createColumnHelper<TestData>();

const columns: MaterialColumnDef<TestData, any>[] = [
  columnHelper.accessor('id', {
    header: 'ID',
    enableEditing: false,
  }),
  columnHelper.accessor('editableString', {
    header: 'Editable string',
  }),
  columnHelper.accessor('editableTime', {
    header: 'Editable time',
    sortingFn: 'datetime',
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
    sortingFn: 'basic',
    cell: ({ row }) => <Checkbox checked={row.original.editableCheckbox} disabled />,
    EditCell: ctx => (
      <EditableCheckbox
        checked={ctx.row.original.editableCheckbox}
        ctx={ctx}
      />
    ),
  }),
];

function createRow(id: string, editableString: string, editableTime: Date, editableCheckbox: boolean): TestData {
  return {
    id,
    editableString,
    editableTime,
    editableCheckbox,
  };
}

const data = [
  createRow('unique_id1', 'test string', new Date('2020-07-15T15:51:17.885Z'), false),
  createRow('unique_id2', 'test string 2', new Date('2019-07-15T15:51:17.885Z'), true),
  createRow('unique_id3', 'test string 3', new Date('2020-09-15T15:51:17.885Z'), false),
];

function createWrapper<T>(props: MaterialTableProps<T>) {
  render(
    withRoot(
      <MaterialTable {...props} />
    )
  );
}

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

  const expectHeadersExist = (headers = columns) => {
    headers.forEach(col => {
      expect(screen.getByRole('columnheader', { name: col.header as string })).toBeInTheDocument();
    });
  };

  test('without data', () => {
    render(
      <MaterialTable
        columns={columns}
        data={[]}
      />
    );

    // Only header row should exist
    expect(screen.getAllByRole('row')).toHaveLength(1);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    expectNoLoadingElements();
    expectNoEditElements();
    expectHeadersExist();
  });

  test('without data (null)', () => {
    const spies = silenceConsole();
    expect(() => render(
      <MaterialTable
        columns={columns}
        // @ts-expect-error
        data={null}
      />
    )).toThrow(TypeError);
    restoreMocks(spies);
  });

  test('with data', () => {
    render(
      <MaterialTable
        columns={columns}
        data={data}
        editable
        deletable
        creatable
        sortable
        pagination
        CreateDialog={() => null}
      />
    );

    // Make sure sort buttons exist
    columns.forEach(col => {
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
    render(
      <MaterialTable
        columns={columns}
        data={data}
        loading
        pagination
      />
    );

    expect(screen.getByRole('progressbar', { name: /loading icon/i })).toBeInTheDocument();
    // No skeletons should be visible
    expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(data.length + 1);
  });

  test('when loading without existing rows', () => {
    render(
      <MaterialTable
        columns={columns}
        data={[]}
        loading
        pagination
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
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(
        row.getByRole('button', { name: /edit row/i })
      );
    });

    await act(async () => {
      await user.click(
        row.getByRole('button', { name: /save row/i })
      );
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /cancel edit/i })).not.toBeInTheDocument();
  });

  it('should not call save when cancel clicked', async () => {
    const onSave = vi.fn();

    createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(
        row.getByRole('button', { name: /edit row/i })
      );
    });

    await act(async () => {
      await user.click(
        row.getByRole('button', { name: /cancel edit/i })
      );
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /save row/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel edit/i })).not.toBeInTheDocument();
  });

  it('should not allow editing non editable columns', async () => {
    const onSave = vi.fn();

    createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    expect(columns[0].enableEditing).toBeFalse();

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(
        row.getByRole('button', { name: /edit row/i })
      );
    });

    const _temp = row.getByText(data[0].id).closest('td');
    expect(_temp).toBeInTheDocument();
    const cell = within(_temp!);
    // Make sure that no input is present
    expect(cell.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('should allow editing string columns', async () => {
    const onSave = vi.fn().mockImplementation(defaultOnSaveRow);

    createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(
        row.getByRole('button', { name: /edit row/i })
      );
    });

    // Find input and change its value
    const input = row.getByLabelText(/editable string input/i);

    const newVal = 'value changed';

    await act(async () => {
      await user.clear(input);
      await user.type(input, newVal);
    });

    await act(async () => {
      await user.click(
        row.getByRole('button', { name: /save row/i })
      );
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ editableString: newVal }, expect.anything());

    expect(row.getByText(newVal)).toBeInTheDocument();
  });

  it('should allow editing checkbox', async () => {
    const onSave = vi.fn().mockImplementation(defaultOnSaveRow);

    createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    const dataOriginal = { ...data[0] };

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(
        row.getByRole('button', { name: /edit row/i })
      );
    });

    // Find checkbox and click it to change it's value
    const checkbox = row.getByRole('checkbox', { checked: dataOriginal.editableCheckbox });
    await user.click(checkbox);

    await act(async () => {
      await user.click(
        row.getByRole('button', { name: /save row/i })
      );
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ editableCheckbox: !dataOriginal.editableCheckbox }, expect.anything());
  });
});
