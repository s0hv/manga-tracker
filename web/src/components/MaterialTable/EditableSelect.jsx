import React from 'react';
import { Select, MenuItem } from '@material-ui/core';
import PropTypes from 'prop-types';
import { processCellEdit } from './useEditable';

/**
 * Select component that modifies react table state when edited, allowing
 * user edits to be saved.
 */
export const EditableSelect = (props) => {
  const {
    value: initialValue,
    items,
    row,
    state,
    cell,
    onChange,
    ...selectProps
  } = props;

  const [value, setValue] = React.useState(initialValue);

  const handleChange = (event) => {
    const val = event.target.value;

    // Set the value to the visible text
    const textVal = items.find((item) => item.value === val)?.text;
    processCellEdit(textVal, state.rowEditStates, cell);
    setValue(val);
    if (typeof onChange === 'function') {
      onChange(val, {
        row,
        state,
        cell,
      });
    }
  };

  return (
    <Select
      value={value}
      {...selectProps}
      onChange={handleChange}
    >
      {items.map(item => (
        <MenuItem value={item.value} key={item.value}>{item.text}</MenuItem>
      ))}
    </Select>
  );
};

const value = PropTypes.oneOfType([PropTypes.number, PropTypes.string]);
EditableSelect.propTypes = {
  value: value.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      value: value.isRequired,
      text: PropTypes.string.isRequired,
    })
  ).isRequired,
  row: PropTypes.object.isRequired,
  cell: PropTypes.object.isRequired,
  state: PropTypes.object.isRequired,
  onChange: PropTypes.func,
};
