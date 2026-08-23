import React, { useCallback } from 'react';
import {
  DateTimePicker,
  DateTimePickerProps,
} from '@mui/x-date-pickers/DateTimePicker';
import { PickerValidDate } from '@mui/x-date-pickers/models';
import type {
  CellContext,
  Plugins,
  RowData,
  TableFeatures,
} from '@tanstack/react-table';

import {
  processCellEdit,
  TableFeaturesWithRowEditing,
} from './plugins';

export interface EditableDateTimePickerProps<
  TFeatures extends TableFeaturesWithRowEditing,
  TData extends RowData
> extends Partial<Omit<DateTimePickerProps, 'value'>> {
  ctx: CellContext<TFeatures, TData, PickerValidDate | null | undefined>
  value: PickerValidDate | null | undefined
}

/**
 * KeyboardDateTimePicker that saves it's state in a react table row
 * @param {Object} props Props given to the component
 * @param {Date?} props.value Initial date that the component will be set to
 */
export default function EditableDateTimePicker<
  TFeatures extends TableFeatures & Pick<Plugins, 'rowEditingPlugin'>,
  TData extends RowData
>(
  props: EditableDateTimePickerProps<TFeatures, TData>
): React.ReactElement {
  const {
    value,
    ctx: { cell },
    onChange,
    ...pickerProps
  } = props;

  // Undefined date is treated as the current date. null is treated as no date
  const [date, setDate] = React.useState<PickerValidDate | null>(value ?? null);

  const handleChange = useCallback((newDate: PickerValidDate | null): void => {
    processCellEdit(newDate, cell);
    setDate(newDate);
  }, [cell]);

  return (
    <DateTimePicker
      value={date}
      onChange={onChange ?? handleChange}
      slotProps={{ textField: { variant: 'standard' }}}
      {...pickerProps}
    />
  );
}
