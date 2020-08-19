import React from 'react';
import { Checkbox } from '@material-ui/core';
import { processCellEdit } from './useEditable';

/**
 * Checkbox component that modifies react table state when edited, allowing
 * user edits to be saved
 * @param {Object} props Component props
 * @param {boolean} props.checked Determines whether the checkbox is initially checked or not
 * @param {Object} props.row Current row generated by react table
 * @param {Object} props.state Current react table state
 * @param {Object} props.cell Cell containing the checkbox generated by react table
 * @param {CheckboxProps} props.checkboxProps Additional props given to the `Checkbox` component
 */
export default function EditableCheckbox(props) {
  const {
    checked: initialValue,
    row,
    state,
    cell,
    ...checkboxProps
  } = props;

  const [value, setValue] = React.useState(initialValue);

  const handleChange = (event) => {
    processCellEdit(event.target.checked, state.rowEditStates, cell);
    setValue(event.target.checked);
  };

  return (
    <Checkbox
      checked={value}
      {...checkboxProps}
      onChange={handleChange}
    />
  );
}
