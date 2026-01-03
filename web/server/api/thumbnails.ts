import { Readable } from 'node:stream';
import type * as streamWeb from 'node:stream/web';

import express from 'express';
import type { Application } from 'express-serve-static-core';
import { z } from 'zod';

import { logger } from '@/serverUtils/logging';

// This fixes typing issues with response piping
// https://stackoverflow.com/a/75843145
declare global {
  interface Response {
    readonly body: streamWeb.ReadableStream<Uint8Array> | null
  }
}

const router = express.Router();

const MangadexParams = z.object({
  mangaId: z.uuidv4(),
  coverId: z.uuidv4(),
  extension: z.string().max(3),
  // Mangadex provides 2 thumbnail sizes
  size: z.literal(['256', '512']).optional(),
});

/**
 * Endpoint that proxies mangadex covers, as they must be proxied.
 * @see https://api.mangadex.org/docs/2-limitations/#general-connection-requirements
 * @see https://api.mangadex.org/docs/03-manga/covers/
 */
router.get('/mangadex/:mangaId/:coverId', async (req, res) => {
  const [coverId, extension] = req.params.coverId.split('.', 2);
  const options = MangadexParams.parse({
    mangaId: req.params.mangaId,
    coverId,
    extension,
    size: req.query.size,
  });

  const suffix = options.size
    ? `.${options.size}.jpg`
    : '';
  const url = `https://uploads.mangadex.org/covers/${options.mangaId}/${options.coverId}.${options.extension}${suffix}`;

  const coverRes = await fetch(url, {
    // Copy request headers, as they are used to validate the cache
    headers: req.headers as Record<string, string>,
  });

  if (!coverRes.ok || !coverRes.body) {
    logger.warn('Failed to fetch mangadex cover. %s: %o', coverRes.status, coverRes.headers);
    res.status(500).end();
    return;
  }

  // Copy headers and status
  res.setHeaders(coverRes.headers);
  res.status(coverRes.status);

  // If cache hit, end response
  if (coverRes.status === 304) {
    return res.end();
  }

  // Stream the mangadex response to our response
  Readable.fromWeb(coverRes.body).pipe(res);
});

export default function register(app: Application) {
  app.use('/thumbnails', router);
}
