const getOptionalNumberValue = (value, defaultValue, paramName='Value') => {
  if (value === undefined) {
    return defaultValue;
  }
  const val = Number(value);
  if (!Number.isFinite(val)) {
    throw new TypeError(`${paramName} value ${value} is not a number`);
  }
  return val;
};
module.exports.getOptionalNumberParam = getOptionalNumberValue;

const assertValueBetween = (value, min, max, paramName='Value') => {
  if (value < min || value > max) {
    throw new TypeError(`${paramName} must be between ${min} and ${max}`);
  }

  return value;
};
module.exports.assertValueBetween = assertValueBetween;

const assertValuePositive = (value, paramName='Value') => {
  if (value < 0) {
    throw new TypeError(`${paramName} must be positive`);
  }
  return value;
};
module.exports.assertValuePositive = assertValuePositive;

