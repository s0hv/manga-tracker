import { type ReactNode, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  type SxProps,
} from '@mui/material';
import {
  type FieldValues,
  FormProvider,
  type SubmitHandler,
  useForm,
  type UseFormProps,
} from 'react-hook-form';


export const defaultSx: SxProps = {
  '& .MuiFormControl-root': { mt: 2 },
};

export type AddRowFormTemplateProps<TFieldValues extends FieldValues = FieldValues> = {
  fields: ReactNode[],
  onSuccess: SubmitHandler<TFieldValues>
  onClose: () => unknown,
  open: boolean,
  closeOnSubmit?: boolean,
  title?: string,
  sx?: SxProps,
} & UseFormProps<TFieldValues>;

export const AddRowFormTemplate = <TFieldValues extends FieldValues = FieldValues>(
  props: AddRowFormTemplateProps<TFieldValues>
) => {
  const {
    fields,
    onSuccess,
    onClose,
    open,
    closeOnSubmit = true,
    title,
    sx = defaultSx,
    ...formProps
  } = props;

  const onSubmitInner = useCallback<SubmitHandler<TFieldValues>>(async (data) => {
    await onSuccess(data);
    if (closeOnSubmit) {
      onClose();
    }
  }, [onSuccess, closeOnSubmit, onClose]);

  const methods = useForm<TFieldValues>(formProps);

  return (
    <Dialog open={open} onClose={onClose} aria-label='Create item form'>
      <DialogTitle>{title || 'Create row'}</DialogTitle>
      <DialogContent>
        <FormProvider {...methods}>
          <Box
            component='form'
            noValidate
            id='create-row-form'
            onSubmit={methods.handleSubmit(onSubmitInner)}
            sx={sx}
          >
            {fields}
          </Box>
        </FormProvider>
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
