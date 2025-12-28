import type { Application, Request, Response } from 'express-serve-static-core';
import RSS from 'rss';

import { getLatestReleases, LatestRelease } from '@/db/db';


function createFeed(rows: LatestRelease[]) {
  const feed = new RSS({
    title: 'Manga releases',
    description: 'Latest manga releases',
    id: 'manga-tracker-rss',
    link: process.env.HOST,
    feed_url: `${process.env.HOST.toString()}/rss`,
    custom_namespaces: {
      manga: 'test',
    },
    ttl: 60,
  });

  rows.forEach(row => {
    feed.item({
      title: row.title,
      guid: row.chapterId,
      url: row.chapterUrlFormat.replace('{}', row.chapterIdentifier).replace('{title_id}', row.titleId),
      description: `${row.mangaTitle} - Chapter ${row.chapterNumber}${row.chapterDecimal ? '.' + row.chapterDecimal : ''}`,
      author: row.group,
      pubDate: row.releaseDate,
      source: row.serviceName,
      source_url: row.url,
      custom_elements: [
        { 'manga:id': row.mangaId },
        { 'manga:title': row.mangaTitle },
        { 'manga:cover': row.cover },
      ],
    });
  });

  return feed.xml({ indent: true });
}

export default (app: Application) => {
  app.get('/rss{/:user}', (req: Request, res: Response) => {
    const uuid = req.params.user;
    if (uuid && uuid.length !== 32) {
      res.sendStatus(404);
      return;
    }

    getLatestReleases(req.query.serviceId as string, req.query.mangaId as string, uuid)
      .then(rows => {
        if (rows.length === 0) {
          res.sendStatus(404);
          return;
        }

        res.set('Content-Type', 'application/rss+xml');
        res.send(Buffer.from(createFeed(rows)));
      })
      .catch(err => {
        console.error(err);
        res.status(500).send('500 ISE');
      });
  });
};
