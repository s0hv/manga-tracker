import React from 'react';
import {
  MenuItem,
  Select,
  SelectChangeEvent,
  SelectProps,
} from '@mui/material';
import type { CellContext } from '@tanstack/react-table';

import {
  processCellEdit,
  TableFeaturesWithRowEditing,
} from './plugins';

export interface EditableSelectProps<
  TFeatures extends TableFeaturesWithRowEditing,
  TData extends Record<string, any>,
  TValue extends number | string | undefined
> extends Omit<SelectProps<number | string>, 'onChange'> {
  ctx: CellContext<TFeatures, TData, TValue>
  items: { value: TValue, text: string }[]
  onChange?: (val: TValue, ctx: CellContext<TFeatures, TData, TValue>) => void
  value: TValue
}

/**
 * Select component that modifies the react-table state when edited, allowing
 * user edits to be saved.
 */
export const EditableSelect = <
  TFeatures extends TableFeaturesWithRowEditing,
  TData extends Record<string, any>,
  TValue extends number | string | undefined
>(props: EditableSelectProps<TFeatures, TData, TValue>): React.ReactElement => {
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

    processCellEdit(val as TValue, ctx.cell);
    setValue(val as TValue);
    onChange?.(val as TValue, ctx);
  };

  return (
    <Select
      value={value}
      {...selectProps}
      onChange={handleChange}
    >
      {items.map(item => (
        <MenuItem value={item.value} key={item.value}>
          {item.text}
        </MenuItem>
      ))}
    </Select>
  );
};
