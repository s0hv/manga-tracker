import React from 'react';
import fetchMock from 'fetch-mock';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '@material-ui/core';
import {
  defaultOnSaveRow,
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '../../src/components/MaterialTable';
import { mockUTCDates, withRoot } from '../utils';
import { defaultDateFormatRegex } from '../constants';
import { defaultDateFormat } from '../../src/utils/utilities';

fetchMock.config.overwriteRoutes = true;

const columns = [
  { Header: 'ID', accessor: 'id', canEdit: false },
  { Header: 'Editable string', accessor: 'editableString' },
  {
    Header: 'Editable time',
    accessor: 'editableTime',
    sortType: 'datetime',
    Cell: ({ row }) => defaultDateFormat(row.values.editableTime),
    EditCell: ({ row, state, cell }) => (
      <EditableDateTimePicker
        clearable={1}
        variant='inline'
        ampm={false}
        value={row.values.editableTime}
        row={row}
        state={state}
        cell={cell}
      />
    ),
  },
  {
    Header: 'Editable checkbox',
    accessor: 'editableCheckbox',
    sortType: 'basic',
    Cell: ({ row }) => <Checkbox checked={row.values.editableCheckbox} disabled />,
    EditCell: ({ row, state, cell }) => (
      <EditableCheckbox
        checked={row.values.editableCheckbox}
        row={row}
        state={state}
        cell={cell}
      />
    ),
  },
];

function createRow(id, editableString, editableTime, editableCheckbox) {
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

function createWrapper(props) {
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
      expect(screen.getByRole('columnheader', { name: col.Header })).toBeInTheDocument();
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
    expect(() => render(
      <MaterialTable
        columns={columns}
        data={null}
      />
    )).toThrow(TypeError);
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
      expect(screen.getByRole('button', { name: col.Header }));
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
        expect(row.getByRole('checkbox', { checked: values.editableCheckbox }));
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

    expect(screen.getByRole('progressbar', { name: /loading icon/i }));
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

    expect(screen.getByRole('progressbar', { name: /loading icon/i }));
    expect(screen.getAllByRole('row')).toHaveLength(1);

    // Skeletons should be rendered
    expect(screen.getAllByRole('row', { hidden: true }).length).toBeGreaterThan(1);
  });
});

describe('Should handle editing', () => {
  test('should call save when save clicked', async () => {
    const onSave = jest.fn();

    createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    act(() => {
      userEvent.click(
        row.getByRole('button', { name: /edit row/i })
      );
    });

    act(() => {
      userEvent.click(
        row.getByRole('button', { name: /save row/i })
      );
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /cancel edit/i })).not.toBeInTheDocument();
  });

  it('should not call save when cancel clicked', async () => {
    const onSave = jest.fn();

    createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    act(() => {
      userEvent.click(
        row.getByRole('button', { name: /edit row/i })
      );
    });

    act(() => {
      userEvent.click(
        row.getByRole('button', { name: /cancel edit/i })
      );
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /save row/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel edit/i })).not.toBeInTheDocument();
  });

  it('should not allow editing non editable columns', async () => {
    const onSave = jest.fn();

    createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    expect(columns[0].canEdit).toBeFalse();

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    act(() => {
      userEvent.click(
        row.getByRole('button', { name: /edit row/i })
      );
    });

    const cell = within(row.getByText(data[0].id).closest('td'));
    // Make sure that no input is present
    expect(cell.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('should allow editing string columns', async () => {
    const onSave = jest.fn().mockImplementation(defaultOnSaveRow);

    createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    act(() => {
      userEvent.click(
        row.getByRole('button', { name: /edit row/i })
      );
    });

    // Find input and change its value
    const input = row.getByLabelText(/editable string input/i);

    const newVal = 'value changed';

    await act(async () => {
      userEvent.clear(input);
      await userEvent.type(input, newVal, { delay: 1 });
    });

    act(() => {
      userEvent.click(
        row.getByRole('button', { name: /save row/i })
      );
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.anything(), { editableString: newVal }, expect.anything());

    expect(row.getByText(newVal)).toBeInTheDocument();
  });

  it('should allow editing checkbox', async () => {
    const onSave = jest.fn().mockImplementation(defaultOnSaveRow);

    createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    const row = within(screen.getAllByRole('row')[1]);
    expect(row).toBeDefined();

    act(() => {
      userEvent.click(
        row.getByRole('button', { name: /edit row/i })
      );
    });

    // Find checkbox and click it to change it's value
    const checkbox = row.getByRole('checkbox', { checked: data[0].editableCheckbox });
    userEvent.click(checkbox);

    act(() => {
      userEvent.click(
        row.getByRole('button', { name: /save row/i })
      );
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.anything(), { editableCheckbox: !data[0].editableCheckbox }, expect.anything());
  });
});
