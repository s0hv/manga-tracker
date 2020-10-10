const getOptionalNumberParam = (param, defaultValue, paramName='Value') => {
  if (param === undefined) {
    return defaultValue;
  }
  const value = Number(param);
  if (!Number.isFinite(value)) {
    throw new TypeError(`${paramName} is not a number`);
  }
  return value;
};

module.exports.getOptionalNumberParam = getOptionalNumberParam;
