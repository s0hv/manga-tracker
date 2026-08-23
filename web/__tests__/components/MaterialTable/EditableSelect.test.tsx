import React from 'react';
import {
  type Cell,
  type CellContext,
  type Row,
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { muiSelectValue } from '../../utils';
import { EditableSelect } from '@/components/MaterialTable';
import { getRowEditStateFromRow, rowEditingPlugin } from '@/components/MaterialTable/plugins';

interface TestData {
  id: string
  status: string
}

const options = [
  { value: 'open', text: 'Open' },
  { value: 'closed', text: 'Closed' },
];

const selectLabel = 'status select';

const features = tableFeatures({
  rowEditingPlugin,
});
type Features = typeof features;

const columnHelper = createColumnHelper<Features, TestData>();

const columns = columnHelper.columns([
  columnHelper.accessor('status', {
    header: 'Status',
  }),
]);

const getData: () => TestData[] = () => ([
  { id: '1', status: 'open' },
]);

const useTestTable = () => useTable({
  features,
  columns,
  data: getData(),
});

const getStatusCell = () => {
  const table = renderHook(() => useTestTable()).result.current;
  const row = table.getRowModel().rows[0];
  const cell = row.getAllCellsByColumnId()['status'] as Cell<Features, TestData, string>;

  return { row, cell };
};

/**
 * Marks the given row as being edited so that edits made through `EditableSelect`
 * are actually persisted to the row's edit state, mirroring what happens when the
 * row is edited through `MaterialTable`.
 */
const startEditing = (row: Row<Features, TestData>) => {
  act(() => {
    row.startEditing();
  });
};

const saveEdits = (row: Row<Features, TestData>) => {
  act(() => {
    row.saveEdits();
  });
};

const renderEditableSelect = (
  cell: Cell<Features, TestData, string>,
  onChange?: (val: string, ctx: CellContext<Features, TestData, string>) => void
) => {
  const ctx = cell.getContext();

  render(
    <EditableSelect
      ctx={ctx}
      items={options}
      value={cell.getValue()}
      onChange={onChange}
      aria-label={selectLabel}
    />
  );

  return ctx;
};

const selectItem = (user: ReturnType<typeof userEvent.setup>, value: string | RegExp) =>
  muiSelectValue(user, screen, selectLabel, value);

describe('EditableSelect', () => {
  const expectCorrectInitialValue = () => expect(screen.getByRole('combobox', { name: selectLabel })).toHaveTextContent('Open');


  it('renders the initial value', () => {
    const { row, cell } = getStatusCell();
    startEditing(row);
    renderEditableSelect(cell);

    expectCorrectInitialValue();
  });

  it('updates the displayed value and the cell edit state when an item is selected', async () => {
    const { row, cell } = getStatusCell();

    startEditing(row);
    renderEditableSelect(cell);
    expectCorrectInitialValue();

    const user = userEvent.setup();
    await selectItem(user, 'Closed');

    expect(screen.getByRole('combobox', { name: selectLabel })).toHaveTextContent('Closed');
    // The text of the selected item is stored, not its underlying value
    expect(getRowEditStateFromRow(row)).toEqual({ status: 'closed' });
    saveEdits(row);
    expect(row.original.status).toStrictEqual('closed');
  });

  it('calls onChange with the selected value and the cell context', async () => {
    const onChange = vi.fn();
    const { row, cell } = getStatusCell();
    startEditing(row);
    const ctx = renderEditableSelect(cell, onChange);
    expectCorrectInitialValue();

    const user = userEvent.setup();
    await selectItem(user, 'Closed');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('closed', ctx);
  });

  it('does not update the cell edit state when the row is not being edited', async () => {
    const { row, cell } = getStatusCell();
    renderEditableSelect(cell);
    expectCorrectInitialValue();

    const user = userEvent.setup();
    await selectItem(user, 'Closed');

    // The displayed value still changes, since that is local component state
    expect(screen.getByRole('combobox', { name: selectLabel })).toHaveTextContent('Closed');
    expect(getRowEditStateFromRow(row)).toEqual({});
  });
});
