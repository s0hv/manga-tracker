import React, { ChangeEvent, PropsWithChildren } from 'react';
import { Checkbox, CheckboxProps } from '@mui/material';
import { RowData } from '@tanstack/react-table';


import { MaterialCellContext } from './types';
import { processCellEdit } from './useEditable';

export interface EditableCheckboxProps<TData extends RowData> extends Omit<CheckboxProps, 'checked'> {
  checked: boolean
  ctx: MaterialCellContext<TData, boolean>
  'aria-label'?: string
}
/**
 * Checkbox component that modifies react table state when edited, allowing
 * user edits to be saved
 * @param {Object} props Component props
 * @param {boolean} props.checked Determines whether the checkbox is initially checked or not
 */
const EditableCheckbox = <TData extends RowData>(props: PropsWithChildren<EditableCheckboxProps<TData>>) => {
  const {
    checked: initialValue,
    ctx: { table, cell },
    'aria-label': ariaLabel,
    ...checkboxProps
  } = props;

  const [value, setValue] = React.useState(initialValue);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    processCellEdit(event.target.checked, table.getState().rowEditState, cell);
    setValue(event.target.checked);
  };

  return (
    <Checkbox
      checked={value}
      {...checkboxProps}
      slotProps={{
        ...checkboxProps.slotProps,
        input: {
          'aria-label': ariaLabel,
          ...checkboxProps.slotProps?.input,
        },
      }}
      onChange={handleChange}
    />
  );
};

export default EditableCheckbox;
