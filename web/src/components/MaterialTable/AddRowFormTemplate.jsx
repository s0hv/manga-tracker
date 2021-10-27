import { useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Form } from 'react-final-form';

/** @jsxImportSource @emotion/react */

export const AddRowFormTemplate = (props) => {
  const {
    fields,
    open,
    onSubmit,
    onClose,
    title,
    formStyles,
    closeOnSubmit = true,
    ...formProps
  } = props;

  const onSubmitInner = useCallback((...args) => {
    onSubmit(...args);
    if (closeOnSubmit) {
      onClose();
    }
  }, [onSubmit, closeOnSubmit, onClose]);

  return (
    <Dialog open={open} onClose={onClose} aria-label='Create item form'>
      <DialogTitle>{title || 'Create row'}</DialogTitle>
      <DialogContent>
        <Form onSubmit={onSubmitInner} {...formProps}>
          {({ handleSubmit }) => (
            <form
              onSubmit={handleSubmit}
              noValidate={!!formProps.validate}
              id='create-row-form'
              css={formStyles}
            >
              {fields}
            </form>
          )}
        </Form>
      </DialogContent>
      <DialogActions>
        <Button
          type='submit'
          variant='outlined'
          color='primary'
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type='submit'
          variant='outlined'
          color='primary'
          form='create-row-form'
        >
          Create row
        </Button>
      </DialogActions>
    </Dialog>
  );
};

AddRowFormTemplate.propTypes = {
  fields: PropTypes.arrayOf(PropTypes.node).isRequired,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  title: PropTypes.string,
  formStyles: PropTypes.object,
};
