alter table service_whole
	add constraint service_whole_pk
		primary key (service_id);

INSERT INTO services
    (service_id, service_name, url, disabled, last_check, chapter_url_format,
     disabled_until, manga_url_format)
VALUES
       (1, 'MANGA Plus', 'https://mangaplus.shueisha.co.jp', FALSE, NULL, 'https://mangaplus.shueisha.co.jp/viewer/{}', NULL, 'https://mangaplus.shueisha.co.jp/titles/{}'),
       (2, 'MangaDex', 'https://mangadex.org', FALSE, NULL, 'https://mangadex.org/chapter/{}', NULL, 'https://mangadex.org/title/{}'),
       (3, 'Jaimini''s Box', 'https://jaiminisbox.com', TRUE, NULL, 'https://jaiminisbox.com/reader/{}', NULL, 'https://jaiminisbox.com/reader/series/{}'),
       (4, 'Kodansha Comics', 'https://kodanshacomics.com', TRUE, NULL, '', NULL, 'https://kodanshacomics.com/series/{}'),
       (5, 'ComiXology', 'https://www.comixology.com', FALSE, NULL, 'https://www.comixology.com/chapter/digital-comic/{}', NULL, 'https://www.comixology.com/series/comics-series/{}'),
       (6, 'Reddit', 'https://www.reddit.com', FALSE, NULL, '{}', NULL, 'https://www.reddit.com/r/{}'),
       (7, 'Kirei Cake', 'https://kireicake.com', FALSE, NULL, 'https://kireicake.com/?p={}', NULL, 'https://kireicake.com/projects/{}')
ON CONFLICT (service_id) DO NOTHING;


INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id)
VALUES
       (1, 'https://jumpg-webapi.tokyo-cdn.com/api/title_list/all', NULL, NULL, NULL),
       (2, 'https://api.mangadex.org', NULL, NULL, NULL),
       (3, 'https://jaiminisbox.com/reader/feeds', NULL, NULL, NULL),
       (4, 'https://kodanshacomics.com/simulpubs', NULL, NULL, NULL),
       (5, 'https://www.comixology.com/New-Manga-Releases/list/24959', NULL, NULL, NULL),
       (7, 'https://kireicake.com/feed/', NULL, NULL, NULL)
ON CONFLICT (service_id) DO UPDATE SET feed_url=excluded.feed_url;
