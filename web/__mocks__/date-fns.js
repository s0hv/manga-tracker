module.exports = ({
  __esModule: true,
  ...jest.requireActual('date-fns'),
  formatDistanceToNowStrict: () => '1 day ago',
});
