export const showErrorAlways = ({
  meta: { submitError, dirtySinceLastSubmit, error },
}) => !!(((submitError && !dirtySinceLastSubmit) || error));
