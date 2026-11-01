import { Readable } from 'node:stream';
import type * as streamWeb from 'node:stream/web';

import { pick } from 'es-toolkit';
import express from 'express';
import type { Application } from 'express-serve-static-core';
import * as z from 'zod';

import { logger } from '@/serverUtils/logging';
import { zodErrorResponse } from '@/serverUtils/validators';

// This fixes typing issues with response piping
// https://stackoverflow.com/a/75843145
declare global {
  interface Response {
    readonly body: streamWeb.ReadableStream<Uint8Array> | null;
  }
}

const CACHE_HEADERS = [
  'date',
  'etag',
  'expires',
  'last-modified',
  'cache-control',
  'content-type',
  'content-length',
];

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
  const result = MangadexParams.safeParse({
    mangaId: req.params.mangaId,
    coverId,
    extension,
    size: req.query.size,
  });

  if (!result.success) {
    zodErrorResponse(res, result.error, 'params');
    return;
  }

  const options = result.data;

  const suffix = options.size
    ? `.${options.size}.jpg`
    : '';
  const url = `https://uploads.mangadex.org/covers/${options.mangaId}/${options.coverId}.${options.extension}${suffix}`;

  // Do not use headers from browser as that leads to bot challenges
  const coverRes = await fetch(url);

  const copyHeaders = () => {
    // Copy only caching related headers and status
    res.setHeaders(new Headers(pick(
      Object.fromEntries(coverRes.headers.entries()),
      CACHE_HEADERS
    )));
    res.status(coverRes.status);
  };

  // If cache hit, end response
  if (coverRes.status === 304) {
    copyHeaders();
    return res.end();
  }

  if (coverRes.status === 404) {
    res.status(404).end();
    return;
  }

  if (!coverRes.ok || !coverRes.body) {
    logger.warn('Failed to fetch mangadex cover. %s: %o', coverRes.status, Object.fromEntries(coverRes.headers.entries()));

    if (coverRes.body) {
      const bodyText = await coverRes.text();
      logger.info('Response body: %s', bodyText);
    }
    res.status(500).end();
    return;
  }

  copyHeaders();

  // Stream the mangadex response to our response
  Readable.fromWeb(coverRes.body).pipe(res);
});

export default function register(app: Application) {
  app.use('/thumbnails', router);
}
