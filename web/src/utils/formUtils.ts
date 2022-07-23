export const showErrorAlways = ({
  meta: { submitError, dirtySinceLastSubmit, error },
}) => !!(((submitError && !dirtySinceLastSubmit) || error));

export const asNumber = (value: any): number => Number(value);
