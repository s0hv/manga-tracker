import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

export default createServerEntry({
  fetch(...args) {
    return handler.fetch(...args);
  },
});
