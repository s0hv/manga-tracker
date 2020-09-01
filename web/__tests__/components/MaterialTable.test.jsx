import React from 'react';
import { createMount } from '@material-ui/core/test-utils';
import fetchMock from 'fetch-mock';
import { createSerializer } from 'enzyme-to-json';
import { act } from 'react-dom/test-utils';

import { format } from 'date-fns';
import enLocale from 'date-fns/locale/en-GB';
import { Checkbox } from '@material-ui/core';
import {
  defaultOnSaveRow,
  EditableCheckbox,
  EditableDateTimePicker,
  MaterialTable,
} from '../../src/components/MaterialTable';
import { editInput, mockUTCDates, withRoot } from '../utils';

fetchMock.config.overwriteRoutes = true;
expect.addSnapshotSerializer(createSerializer({ mode: 'deep' }));

const columns = [
  { Header: 'ID', accessor: 'id', canEdit: false },
  { Header: 'Editable string', accessor: 'editableString' },
  {
    Header: 'Editable time',
    accessor: 'editableTime',
    sortType: 'datetime',
    Cell: ({ row }) => format(row.values.editableTime, 'MMM do, HH:mm', { locale: enLocale }),
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
  return createMount()(
    withRoot(
      <MaterialTable {...props} />
    )
  );
}

describe('It should render correctly', () => {
  mockUTCDates();
  test('without data', () => {
    const wrapper = createMount()(
      <MaterialTable
        columns={columns}
        data={[]}
      />
    );

    expect(wrapper).toMatchSnapshot();
  });

  test('with data', () => {
    const wrapper = createMount()(
      <MaterialTable
        columns={columns}
        data={data}
        editable
        sortable
      />
    );

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Should handle editing', () => {
  test('should call save when save clicked', async () => {
    const onSave = jest.fn();

    const wrapper = createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    const row = wrapper.findWhere(w => w.key() === 'row_0');
    expect(row).toHaveLength(1);
    await act(async () => row.find('button[name="edit"]').simulate('click'));
    wrapper.update();
    await act(async () => wrapper.find('button[name="save"]').simulate('click'));
    wrapper.update();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(wrapper.exists('button[name="cancel"]')).toStrictEqual(false);
  });

  it('should not call save when cancel clicked', async () => {
    const onSave = jest.fn();

    const wrapper = createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    const row = wrapper.findWhere(w => w.key() === 'row_0');
    expect(row).toHaveLength(1);
    await act(async () => row.find('button[name="edit"]').simulate('click'));
    wrapper.update();
    await act(async () => wrapper.find('button[name="cancel"]').simulate('click'));
    wrapper.update();

    expect(onSave).toHaveBeenCalledTimes(0);
    expect(wrapper.exists('button[name="cancel"]')).toStrictEqual(false);
  });

  it('should not allow editing non editable columns', async () => {
    const onSave = jest.fn();

    const wrapper = createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    let row = wrapper.findWhere(w => w.key() === 'row_0');
    expect(row).toHaveLength(1);
    await act(async () => row.find('button[name="edit"]').simulate('click'));
    wrapper.update();

    row = wrapper.findWhere(w => w.key() === 'row_0');
    const cell = row.findWhere(r => r.key() === 'cell_0_id');

    // Make sure that no input is present
    expect(cell.exists('input')).toStrictEqual(false);
    expect(cell.find('td').text()).toStrictEqual(data[0].id);
  });

  it('should allow editing string columns', async () => {
    const onSave = jest.fn().mockImplementation(defaultOnSaveRow);

    const wrapper = createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    let row = wrapper.findWhere(w => w.key() === 'row_0');
    expect(row).toHaveLength(1);
    row.find('button[name="edit"]').simulate('click');
    wrapper.update();

    // Find input and change its value
    row = wrapper.findWhere(w => w.key() === 'row_0');
    const cell = row.findWhere(r => r.key() === 'cell_0_editableString');
    const input = cell.find('input');
    expect(input).toHaveLength(1);
    const newVal = 'value changed';
    await editInput(input, newVal);

    row.find('button[name="save"]').simulate('click');
    wrapper.update();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.anything(), { editableString: newVal }, expect.anything());
    expect(wrapper
      .findWhere(r => r.key() === 'cell_0_editableString')
      .find('td').text()).toStrictEqual(newVal);
  });

  it('should allow editing checkbox', async () => {
    const onSave = jest.fn().mockImplementation(defaultOnSaveRow);

    const wrapper = createWrapper({
      columns,
      data,
      onSaveRow: onSave,
      editable: true,
    });

    let row = wrapper.findWhere(w => w.key() === 'row_0');
    expect(row).toHaveLength(1);
    row.find('button[name="edit"]').simulate('click');
    wrapper.update();

    // Find checkbox and click it to change it's value
    row = wrapper.findWhere(w => w.key() === 'row_0');
    const cell = row.findWhere(r => r.key() === 'cell_0_editableCheckbox');
    const checkbox = cell.find('input');
    expect(checkbox).toHaveLength(1);
    checkbox.simulate('change', { target: { checked: !data[0].editableCheckbox }});

    row.find('button[name="save"]').simulate('click');
    wrapper.update();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.anything(), { editableCheckbox: !data[0].editableCheckbox }, expect.anything());
  });
});
