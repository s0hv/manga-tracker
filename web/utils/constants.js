const csrfMissing = 'Missing CSRF token';
const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';
const NO_GROUP = 1;

module.exports = {
  csrfMissing,
  isDev,
  isTest,
  NO_GROUP,
};
