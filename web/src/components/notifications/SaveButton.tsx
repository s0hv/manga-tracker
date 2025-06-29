import React from 'react';
import { Button } from '@mui/material';


export type SaveButtonProps = {
  submitting?: boolean
  hasValidationErrors?: boolean
};
const SaveButton = ({ submitting, hasValidationErrors }: SaveButtonProps) => (
  <Button
    type='submit'
    variant='contained'
    color='primary'
    disabled={submitting || hasValidationErrors}
    sx={{ mt: 3, mb: 2, ml: 3 }}
  >
    Save
  </Button>
);

export default SaveButton;
