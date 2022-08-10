import type { ShowErrorFunc } from 'mui-rff';

export const showErrorAlways: ShowErrorFunc = ({
  meta: { submitError, dirtySinceLastSubmit, error },
}) => !!(((submitError && !dirtySinceLastSubmit) || error));

export const asNumber = (value: any): number => Number(value);
