import { Server } from 'http';

import { vi } from 'vitest';

export default async function stopServer(httpServer: Server) {
  if (httpServer) {
    console.log('Closing server');
    await new Promise(resolve => httpServer.close(resolve));
  }
  vi.clearAllTimers();
}
