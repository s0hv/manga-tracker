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
      guid: row.chapter_id,
      url: row.chapter_url_format.replace('{}', row.chapter_identifier),
      description: `${row.manga_title} - Chapter ${row.chapter_number}${row.chapter_decimal ? '.' + row.chapter_decimal : ''}`,
      author: row.group,
      pubDate: row.release_date,
      source: row.service_name,
      source_url: row.url,
      custom_elements: [
        { 'manga:id': row.manga_id },
        { 'manga:title': row.manga_title },
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

    getLatestReleases(req.query.service_id, req.query.manga_id, uuid)
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
