export const getOptionalNumberParam = (value, defaultValue, paramName='Value') => {
  if (value === undefined) {
    return defaultValue;
  }
  const val = Number(value);
  if (!Number.isFinite(val)) {
    throw new TypeError(`${paramName} value ${value} is not a number`);
  }
  return val;
};

export const regenerateSession = async (req) => {
  const tempSess = req.session;
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
      } else {
        // Copy old data to new session
        Object.assign(req.session, tempSess);
        resolve();
      }
    });
  });
};
