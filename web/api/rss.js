const { Feed } = require("feed");
const RSS = require('rss');
const { getLatestReleases } = require("../db/db");

function createFeed(rows) {
    const feed2 = new RSS({
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
        feed2.item({
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

    return feed2.xml({indent: true});

    const feed = new Feed({
        title: "Manga releases",
        description: "Latest manga releases",
        id: "localhost",
        link: "localhost",
        feedLinks: {
            rss: "localhost:3000/rss",
            atom: "localhost:3000/atom",
            json: "localhost:3000/json"
        }
    });

    rows.forEach(row => {
        feed.addItem({
            title: row.title,
            id: row.chapter_id,
            link: row.chapter_url_format.replace("{}", row.chapter_identifier),
            description: `${row.manga_title} - Chapter ${row.chapter_number}`,
            published: row.release_date,
            manga: {
                manga_id: row.manga_id,
                manga_title: row.manga_title
            }
        })
    });

    return feed.rss2();
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