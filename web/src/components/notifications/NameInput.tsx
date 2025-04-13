import { TextField, type TextFieldProps } from 'mui-rff';
import React from 'react';

export type NameInputProps = Omit<TextFieldProps, 'name' | 'label'>;
export const NameInput = (textFieldProps: NameInputProps) => (
  <TextField
    margin='normal'
    variant='standard'
    slotProps={{
      htmlInput: { sx: { fontSize: 30 }},
    }}
    sx={{ mb: 5 }}
    {...textFieldProps}
    name='name'
    label='Name'
  />
);

export default NameInput;
