import { vi } from 'vitest';

export default async function stopServer(httpServer) {
  if (httpServer) {
    console.log('Closing server');
    await new Promise(resolve => httpServer.close(resolve));
  }
  vi.clearAllTimers();
}
