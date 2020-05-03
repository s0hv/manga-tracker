const RSS = require('rss');
const { getLatestReleases } = require("../db/db");

function createFeed(rows) {
    const feed = new RSS({
        title: "Manga releases",
        description: "Latest manga releases",
        id: "localhost",
        link: "localhost",
        feed_url: "localhost:3000/rss",
        custom_namespaces: {
            'manga': 'test',
        },
        ttl: 60
    });

    rows.forEach(row => {
        feed.item({
            title: row.title,
            guid: row.chapter_id,
            url: row.chapter_url_format.replace("{}", row.chapter_identifier),
            description: `${row.manga_title} - Chapter ${row.chapter_number}`,
            pubDate: row.release_date,
            source: row.service_name,
            source_url: row.url,
            custom_elements: [
                {'manga:id': row.manga_id},
                {'manga:title': row.manga_title}
            ]
        })
    });

    return feed.xml({indent: true});
}

module.exports = function (app) {
    app.get('/rss', (req, res) => {
        let user_id = req.query.user;
        if (user_id && user_id.length !== 32) {
            res.status(404).send("404");
            return;
        }

        getLatestReleases(req.query.service_id, req.query.manga_id, user_id)
            .then(rows => {
                if (!rows || rows.rowCount === 0) {
                    res.status(404).send("404");
                    return;
                }

                //console.log(rows);
                res.set('Content-Type', 'application/rss+xml');
                res.send(Buffer.from(createFeed(rows.rows)));
            })
            .catch(err => {
                console.log(err);
                res.status(500).send("500 ISE");
            });
    });
}