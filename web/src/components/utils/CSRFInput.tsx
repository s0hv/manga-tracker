import { Field } from 'react-final-form';
import { useCSRF } from '@/webUtils/csrf';

export default function CSRFInput() {
  const csrf = useCSRF();
  return (
    <Field
      name='_csrf'
      component='input'
      type='hidden'
      initialValue={csrf}
      defaultValue={csrf}
    />
  );
}
