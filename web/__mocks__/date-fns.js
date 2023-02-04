import { vi } from 'vitest';

module.exports = ({
  ...(await vi.importActual('date-fns')),
  formatDistanceToNowStrict: () => '1 day ago',
});
