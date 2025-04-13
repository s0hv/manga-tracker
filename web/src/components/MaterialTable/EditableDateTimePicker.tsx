import React from 'react';
import {
  DateTimePicker,
  DateTimePickerProps,
} from '@mui/x-date-pickers/DateTimePicker';
import { PickerValidDate } from '@mui/x-date-pickers/models';

import { processCellEdit } from './useEditable';
import { MaterialCellContext } from './types';

export interface EditableDateTimePickerProps extends Partial<Omit<DateTimePickerProps, 'value'>> {
  ctx: MaterialCellContext<any, PickerValidDate>
  value: PickerValidDate | null | undefined
}

/**
 * KeyboardDateTimePicker that saves it's state in a react table row
 * @param {Object} props Props given to the component
 * @param {Date?} props.value Initial date that the component will be set to
 */
export default function EditableDateTimePicker(props: EditableDateTimePickerProps): React.ReactElement {
  const {
    value,
    ctx: { table, cell },
    onChange,
    ...pickerProps
  } = props;

  // Undefined date is treated as current date. null is treated as no date
  const [date, setDate] = React.useState<PickerValidDate | null>(value ?? null);

  const handleChange = (newDate: PickerValidDate | null): void => {
    processCellEdit(newDate as PickerValidDate, table.getState().rowEditState, cell);
    setDate(newDate);
  };

  return (
    <DateTimePicker
      value={date}
      onChange={onChange ?? handleChange}
      slotProps={{ textField: { variant: 'standard' }}}
      {...pickerProps}
    />
  );
}
