export default async (httpServer) => (
  // Doesn't actually work atm but whatever.  It just stops new connections from being made
  new Promise((resolve => {
    httpServer.close(() => {
      resolve();
    });
  }))
);
