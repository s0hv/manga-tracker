-- insert manga
INSERT INTO manga (manga_id, title, release_interval, latest_release, estimated_release, latest_chapter) VALUES (1, 'Dr. STONE', '0 years 0 mons 7 days 0 hours 0 mins 0.00 secs', '2020-08-02 16:00:00.000000', '2020-08-09 16:00:00.000000', 160);

-- insert services
INSERT INTO services (service_id, service_name, url, disabled, last_check, chapter_url_format, disabled_until, manga_url_format) VALUES (1, 'MANGA Plus', 'https://mangaplus.shueisha.co.jp', false, '2020-08-06 17:39:18.412026', 'https://mangaplus.shueisha.co.jp/viewer/{}', '2020-08-06 17:55:32.412026', 'https://mangaplus.shueisha.co.jp/titles/{}');
INSERT INTO services (service_id, service_name, url, disabled, last_check, chapter_url_format, disabled_until, manga_url_format) VALUES (2, 'MangaDex', 'https://mangadex.org', false, '2020-08-06 17:40:37.886383', 'https://mangadex.org/chapter/{}', '2020-08-06 18:10:37.885381', 'https://mangadex.org/title/{}');
INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id) VALUES (2, 'https://mangadex.org/rss', '2020-08-06 17:40:37.886383', '2020-08-06 18:10:37.886383', '959214');

-- insert manga service relations
INSERT INTO manga_service (manga_id, service_id, disabled, last_check, title_id, next_update, latest_chapter, latest_decimal) VALUES (1, 1, false, '2020-08-05 15:34:01.427921', '100010', '2020-08-10 16:00:00.000000', null, null);
INSERT INTO manga_service (manga_id, service_id, disabled, last_check, title_id, next_update, latest_chapter, latest_decimal) VALUES (1, 2, true, '2020-04-06 13:05:33.853545', '20882', null, null, null);

-- insert chapters
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") VALUES (1, 1, 1, 'Z=1: Stone World', 1, null, '2020-05-24 14:24:12.320726+00', '1000310', 'Shueisha');
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") VALUES (2, 1, 1, 'Z=2: Fantasy vs. Science', 2, null, '2020-05-24 14:24:12.320726+00', '1000311', 'Shueisha');
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") VALUES (3, 1, 1, 'Z=3: King of the Stone World', 3, null, '2020-05-24 14:24:12.320726+00', '1000312', 'Shueisha');
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") VALUES (4, 1, 1, 'Z=138: End of Part 3', 138, null, '2020-05-24 14:24:12.320726+00', '1006278', 'Shueisha');
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") VALUES (5, 1, 1, 'Z=139: First Dream', 139, null, '2020-05-24 14:24:12.320726+00', '1006279', 'Shueisha');
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") VALUES (6, 1, 1, 'Z=140: New World Pilots', 140, null, '2020-05-24 14:24:12.320726+00', '1006280', 'Shueisha');
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") VALUES (7, 1, 1, 'Z=141: First Team', 141, null, '2020-05-24 14:24:12.320726+00', '1006412', 'Shueisha');
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") VALUES (122, 1, 1, 'Z=142: World Power', 142, null, '2020-05-24 14:24:12.320726+00', '1006413', 'Shueisha');
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") VALUES (884, 1, 1, 'Z=143: Ryusui vs. Senku', 143, null, '2020-05-24 14:24:12.320726+00', '1006414', 'Shueisha');
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") VALUES (1010, 1, 2, 'Chapter 142', 142, null, '2020-05-24 14:24:12.320726+00', '823275', 'MangaPlus');

--insert manga info
INSERT INTO manga_info (manga_id, cover, status, artist, author, bw, mu, mal, amz, ebj, engtl, raw, nu, kt, ap, al, last_updated) VALUES (1, 'https://mangadex.org/images/manga/20882.jpg?1585634146', 0, 'Boichi', 'Inagaki Riichiro', 'series/114645', '139601', '103897', 'https://www.amazon.co.jp/gp/product/B075F8JBQ1', 'https://www.ebookjapan.jp/ebj/413780/', 'https://www.viz.com/dr-stone', null, null, '38860', 'dr-stone', '98416', '2020-06-28 11:15:55.170446');

-- insert user
INSERT INTO users (user_id, username, email, pwhash, user_uuid, joined_at, admin, theme) VALUES (1, 'test ci', 'test@test.com', crypt('te!st-pa#ss)wo(rd123', gen_salt('bf')), '22fc15c9-37b9-4869-af86-b334333dedd8', '2020-07-08 12:00:00.344806', true, 2);

-- insert follows
INSERT INTO user_follows (manga_id, service_id, user_id) VALUES (1, 1, 1);
