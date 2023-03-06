import React from 'react';
import {
  DateTimePicker,
  DateTimePickerProps,
} from '@mui/x-date-pickers/DateTimePicker';

import { processCellEdit } from './useEditable';
import { MaterialCellContext } from './types';

export interface EditableDateTimePickerProps<TInputDate> extends Partial<DateTimePickerProps<TInputDate>> {
  ctx: MaterialCellContext<any, TInputDate>
}

/**
 * KeyboardDateTimePicker that saves it's state in a react table row
 * @param {Object} props Props given to the component
 * @param {Date?} props.value Initial date that the component will be set to
 */
export default function EditableDateTimePicker<TInputDate>(props: EditableDateTimePickerProps<TInputDate>): React.ReactElement {
  const {
    value,
    ctx: { table, cell },
    onChange,
    ...pickerProps
  } = props;

  // Undefined date is treated as current date. null is treated as no date
  const [date, setDate] = React.useState<TInputDate | null>(value || null);

  const handleChange = (newDate: TInputDate | null): void => {
    processCellEdit(newDate as TInputDate, table.getState().rowEditState, cell);
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
