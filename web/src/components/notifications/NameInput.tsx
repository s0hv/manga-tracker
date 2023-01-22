import { TextField, type TextFieldProps } from 'mui-rff';
import React from 'react';

const NameInput = (textFieldProps: Partial<TextFieldProps>) => (
  <TextField
    margin='normal'
    variant='standard'
    inputProps={{ sx: { fontSize: 30 }}}
    sx={{ mb: 5 }}
    {...textFieldProps}
    name='name'
    label='Name'
  />
);

export default NameInput;
