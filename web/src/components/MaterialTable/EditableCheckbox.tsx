import React, { ChangeEvent, PropsWithChildren, useCallback } from 'react';
import { Checkbox, CheckboxProps } from '@mui/material';
import { type CellContext, RowData } from '@tanstack/react-table';

import {
  type TableFeaturesWithRowEditing,
  processCellEdit,
} from './plugins';

export interface EditableCheckboxProps<
  TFeatures extends TableFeaturesWithRowEditing,
  TData extends RowData
> extends Omit<CheckboxProps, 'checked'> {
  checked: boolean
  ctx: CellContext<TFeatures, TData, boolean>
  'aria-label'?: string
}
/**
 * Checkbox component that modifies the react-table state when edited, allowing
 * user edits to be saved
 * @param {Object} props Component props
 * @param {boolean} props.checked Determines whether the checkbox is initially checked or not
 */
const EditableCheckbox = <
  TFeatures extends TableFeaturesWithRowEditing,
  TData extends RowData
>(props: PropsWithChildren<EditableCheckboxProps<TFeatures, TData>>) => {
  const {
    checked: initialValue,
    ctx: { cell },
    'aria-label': ariaLabel,
    ...checkboxProps
  } = props;

  const [value, setValue] = React.useState(initialValue);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    processCellEdit(event.target.checked, cell);
    setValue(event.target.checked);
  }, [cell]);

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
