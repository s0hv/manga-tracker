const RSS = require('rss');
const { getLatestReleases } = require('../db/db');

function createFeed(rows) {
  const feed = new RSS({
    title: 'Manga releases',
    description: 'Latest manga releases',
    id: 'manga-tracker-rss',
    link: 'https://manga-tracker-rss.herokuapp.com',
    feed_url: 'https://manga-tracker-rss.herokuapp.com/rss',
    custom_namespaces: {
      manga: 'test',
    },
    ttl: 60,
  });

  rows.forEach(row => {
    feed.item({
      title: row.title,
      guid: row.chapterId,
      url: row.chapterUrlFormat.replace('{}', row.chapterIdentifier),
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

module.exports = app => {
  app.get('/rss/:user?', (req, res) => {
    const uuid = req.params.user;
    if (uuid && uuid.length !== 32) {
      res.status(404).send('404');
      return;
    }

    getLatestReleases(req.query.serviceId, req.query.mangaId, uuid)
      .then(rows => {
        if (rows.length === 0) {
          res.status(404).send('404');
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
