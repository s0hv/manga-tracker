import { Button } from '@mui/material';
import React from 'react';
import PropTypes from 'prop-types';


const SaveButton = ({ submitting, hasValidationErrors }) => (
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
SaveButton.propTypes = {
  submitting: PropTypes.bool,
  hasValidationErrors: PropTypes.bool,
};

export default SaveButton;
