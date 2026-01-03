import type { Register } from '@tanstack/react-router';
import type { RequestHandler } from '@tanstack/react-start/server';

// This will be the request handler in the actual implementation.
// During development, it is not required and can be safely stubbed.
const module: { fetch: RequestHandler<Register> } = {
  fetch: () => {
    throw new Error('This mode requires the server to be built');
  },
};

export default module;
