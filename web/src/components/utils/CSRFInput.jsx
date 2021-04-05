import { Field } from 'react-final-form';
import { useCSRF } from '../../utils/csrf';

export default function CSRFInput() {
  const csrf = useCSRF();
  return (
    <Field
      name='_csrf'
      component='input'
      type='hidden'
      defaultValue={csrf}
    />
  );
}
