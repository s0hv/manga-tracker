import React from 'react';
import { type Path, FieldValues } from 'react-hook-form';
import {
  type TextFieldElementProps,
  TextFieldElement,
} from 'react-hook-form-mui';


export type NameInputProps<TFieldValues extends FieldValues = FieldValues> = Omit<TextFieldElementProps<TFieldValues>, 'name'>;
export const NameInput = <TFieldValues extends FieldValues = FieldValues>(textFieldProps: NameInputProps<TFieldValues>) => (
  <TextFieldElement
    margin='normal'
    variant='standard'
    slotProps={{
      htmlInput: { sx: { fontSize: 30 }},
    }}
    sx={{ mb: 5 }}
    fullWidth
    {...textFieldProps}
    name={'name' as Path<TFieldValues>}
    label='Name'
  />
);
