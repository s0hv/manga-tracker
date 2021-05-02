const csrfMissing = 'Missing CSRF token';
const isDev = process.env.NODE_ENV !== 'production';


module.exports = {
  csrfMissing,
  isDev,
};
