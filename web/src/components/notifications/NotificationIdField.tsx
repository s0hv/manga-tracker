import { Field } from 'react-final-form';
import React from 'react';

const NotificationIdField = () => (
  <Field
    name='notificationId'
    component='input'
    type='hidden'
    subscription={{ value: true }}
  />
);

export default NotificationIdField;
