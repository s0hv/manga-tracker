/* istanbul ignore file */
import type { Express } from 'express-serve-static-core';
import type { NodeHttp1Handler } from 'srvx';
import { type AdapterMeta, toNodeHandler } from 'srvx/node';

export const tanstackIntegration = async (server: Express) => {
  // eslint-disable-next-line import/no-extraneous-dependencies
  const viteDevServer = await import('vite').then(vite =>
    vite.createServer({
      server: { middlewareMode: true },
    }));

  server.use(viteDevServer.middlewares);
  server.use(async (req, res, next) => {
    try {
      const { default: serverEntry } =
        await viteDevServer.ssrLoadModule('src/server.ts') as typeof import('#web/server');

      const wrappedHandler: AdapterMeta['__fetchHandler'] = request =>
        serverEntry.fetch(request, {
          context: {
            session: req.session,
            user: req.user,
            nonce: req.getNonce(),
          },
        });
      const handler = toNodeHandler(wrappedHandler) as NodeHttp1Handler;
      await handler(req, res);
    } catch (error) {
      if (typeof error === 'object' && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error);
      }
      next(error);
    }
  });
};
