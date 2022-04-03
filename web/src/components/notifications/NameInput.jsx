import { TextField } from 'mui-rff';
import React from 'react';

const NameInput = () => (
  <TextField
    margin='normal'
    name='name'
    label='Name'
    variant='standard'
    inputProps={{ sx: { fontSize: 30 }}}
    sx={{ mb: 5 }}
  />
);

export default NameInput;
