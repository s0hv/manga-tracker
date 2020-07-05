export default async (httpServer) => {
  httpServer.close();
  return Promise.resolve();
};
