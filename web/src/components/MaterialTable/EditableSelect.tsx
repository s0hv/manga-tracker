import React from 'react';
import {
  MenuItem,
  Select,
  SelectChangeEvent,
  SelectProps,
} from '@mui/material';
import type { RowData } from '@tanstack/react-table';
import { processCellEdit } from './useEditable';
import { MaterialCellContext } from './types';


export interface EditableSelectProps<TData extends RowData, TValue extends number | string> extends Omit<SelectProps<number | string>, 'onChange'> {
  ctx: MaterialCellContext<TData, any>
  items: { value: TValue, text: string }[]
  onChange?: (val: TValue, ctx: MaterialCellContext<TData, any>) => void
  value: TValue
}

/**
 * Select component that modifies react table state when edited, allowing
 * user edits to be saved.
 */
export const EditableSelect = <TData, TValue extends number | string>(props: EditableSelectProps<TData, TValue>): React.ReactElement => {
  const {
    value: initialValue,
    items,
    ctx,
    onChange,
    ...selectProps
  } = props;

  const [value, setValue] = React.useState<TValue>(initialValue);

  const handleChange = (event: SelectChangeEvent<string | number>) => {
    const val = event.target.value;

    // Set the value to the visible text
    const textVal = items.find((item) => item.value === val)?.text;
    processCellEdit(textVal, ctx.table.getState().rowEditState, ctx.cell);
    setValue(val as TValue);
    if (typeof onChange === 'function') {
      onChange(val as TValue, ctx);
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
