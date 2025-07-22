import type { Request, Response } from 'express-serve-static-core';
module.exports = () => ({
  prepare: () => Promise.resolve(),
  getRequestHandler: () => (req: Request, res: Response) => res.status(404).send('Not found'),
});
