import React from 'react';
import {
  type ColumnDef,
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { withRoot } from '../../utils';
import { MaterialTable } from '@/components/MaterialTable';
import { getEditColumnDef, rowEditingPlugin } from '@/components/MaterialTable/plugins';

const features = tableFeatures({ rowEditingPlugin });
type Features = typeof features;

type TestData = {
  id: string;
  value: string;
};

type RootProps = {
  data: TestData[];
  columns: ColumnDef<Features, TestData>[];
};

const Root = ({ data, columns }: RootProps) => {
  const table = useTable({ features, data, columns });

  return <MaterialTable table={table} />;
};

const columnHelper = createColumnHelper<Features, TestData>();
const editColumn = getEditColumnDef<Features, TestData>();
const idColumn = columnHelper.accessor('id', { header: 'ID' });
const getValueColumn = (prefix: string) => columnHelper.accessor('value', {
  header: 'Value',
  cell: info => `${prefix} ${info.getValue()}`,
  EditCell: () => `${prefix} edit cell`,
});

// Each test passes the same data array to every render, so TanStack Table keeps
// the same row objects and only the columns or the row values change.
const getData = (): TestData[] => [{ id: '1', value: 'original' }];

describe('MaterialTableRow', () => {
  it('renders the new cells when only the columns change', () => {
    const data = getData();
    const { rerender } = render(withRoot(
      <Root data={data} columns={columnHelper.columns([getValueColumn('first')])} />
    ));

    expect(screen.getByRole('cell', { name: 'first original' })).toBeInTheDocument();

    rerender(withRoot(
      <Root data={data} columns={columnHelper.columns([getValueColumn('second')])} />
    ));

    expect(screen.getByRole('cell', { name: 'second original' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'first original' })).not.toBeInTheDocument();
  });

  it('renders cells for columns added after the first render', () => {
    const data = getData();
    const { rerender } = render(withRoot(
      <Root data={data} columns={columnHelper.columns([getValueColumn('first')])} />
    ));

    rerender(withRoot(
      <Root data={data} columns={columnHelper.columns([idColumn, getValueColumn('first')])} />
    ));

    const row = within(screen.getAllByRole('row')[1]);
    expect(row.getAllByRole('cell')).toHaveLength(2);
    expect(row.getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(row.getByRole('cell', { name: 'first original' })).toBeInTheDocument();
  });

  it('renders the new edit cells when the columns change while the row is being edited', async () => {
    const data = getData();
    const { rerender } = render(withRoot(
      <Root data={data} columns={columnHelper.columns([editColumn, getValueColumn('first')])} />
    ));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^edit row$/i }));
    expect(screen.getByRole('cell', { name: 'first edit cell' })).toBeInTheDocument();

    rerender(withRoot(
      <Root data={data} columns={columnHelper.columns([editColumn, getValueColumn('second')])} />
    ));

    expect(screen.getByRole('cell', { name: 'second edit cell' })).toBeInTheDocument();
  });

  it('updates non-editable cells that show an edited value after saving', async () => {
    const data = getData();
    const columns = columnHelper.columns([
      editColumn,
      columnHelper.accessor('value', { header: 'Value' }),
      columnHelper.display({
        id: 'summary',
        header: 'Summary',
        enableEditing: false,
        cell: ({ row }) => `Summary: ${row.original.value}`,
      }),
    ]);
    render(withRoot(<Root data={data} columns={columns} />));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^edit row$/i }));
    const input = screen.getByLabelText(/^value input$/i);
    await user.clear(input);
    await user.type(input, 'edited');
    // The default save handler writes the edited values into the existing row object
    await user.click(screen.getByRole('button', { name: /^save row$/i }));

    expect(screen.getByRole('cell', { name: 'Summary: edited' })).toBeInTheDocument();
  });
});
