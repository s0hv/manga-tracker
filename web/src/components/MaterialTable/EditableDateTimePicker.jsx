import React from 'react';
import DateTimePicker from '@mui/lab/DateTimePicker';
import { TextField } from '@mui/material';

import { processCellEdit } from './useEditable';

/**
 * KeyboardDateTimePicker that saves it's state in a react table row
 * @param {Object} props Props given to the component
 * @param {Date?} props.value Initial date that the component will be set to
 * @param {Object} props.row Current row generated by react table
 * @param {Object} props.state Current react table state
 * @param {Object} props.cell Cell containing the checkbox generated by react table
 * @param {Object} props.pickerProps Props passed to KeyboardDateTimePicker
 */
export default function EditableDateTimePicker(props) {
  const {
    row,
    state,
    cell,
    value,
    ...pickerProps
  } = props;

  // Undefined date is treated as current date. null is treated as no date
  const [date, setDate] = React.useState(value || null);

  const handleChange = (newDate) => {
    processCellEdit(newDate, state.rowEditStates, cell);
    setDate(newDate);
  };

  return (
    <DateTimePicker
      value={date}
      onChange={handleChange}
      renderInput={(params) => <TextField {...params} variant='standard' />}
      {...pickerProps}
    />
  );
}
