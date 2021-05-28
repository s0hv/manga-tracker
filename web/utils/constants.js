const csrfMissing = 'Missing CSRF token';
const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';


module.exports = {
  csrfMissing,
  isDev,
  isTest,
};
