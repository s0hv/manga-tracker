const mockedLogger = {
  info: console.info,
  error: console.error,
  debug: console.debug,
  log: console.log,
  warn: console.warn
};

module.exports = jest.fn().mockImplementation(() => ({
  ...mockedLogger,
  child: jest.fn().mockImplementation(() => mockedLogger),
}));
