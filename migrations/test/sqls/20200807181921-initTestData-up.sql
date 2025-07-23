SET TIME ZONE 'UTC';

-- Reset service sequence
SELECT setval(pg_get_serial_sequence('services', 'service_id'), MAX(service_id)) FROM services;

-- insert manga
INSERT INTO manga (manga_id, title, release_interval, latest_release, estimated_release, latest_chapter) VALUES (1, 'Dr. STONE', '0 years 0 mons 7 days 0 hours 0 mins 0.00 secs', '2020-08-02 16:00:00.000000', '2020-08-09 16:00:00.000000', 160);
INSERT INTO manga (manga_id, title, release_interval, latest_release, estimated_release, latest_chapter) VALUES (2, 'ABCDEFG', '0 years 0 mons 31 days 0 hours 0 mins 0.00 secs', '2020-07-02 16:00:00.000000', '2020-08-02 16:00:00.000000', 1);
INSERT INTO manga (manga_id, title, release_interval, latest_release, estimated_release, latest_chapter) VALUES (3, 'This is a test', '0 years 0 mons 90 days 0 hours 0 mins 0.00 secs', '2020-03-02 16:00:00.000000', '2020-06-02 16:00:00.000000', 50);
INSERT INTO manga (manga_id, title, release_interval, latest_release, estimated_release, latest_chapter) VALUES (4, 'Jojo part 2', '0 years 0 mons 30 days 0 hours 0 mins 0.00 secs', '2020-03-02 16:00:00.000000', '2020-06-02 16:00:00.000000', NULL);

-- insert aliases
INSERT INTO manga_alias (manga_id, title) VALUES (1, 'Test alias');
INSERT INTO manga_alias (manga_id, title) VALUES (2, 'Test alias 2');
INSERT INTO manga_alias (manga_id, title) VALUES (2, 'Test abc');

SELECT setval(pg_get_serial_sequence('manga', 'manga_id'), MAX(manga_id)) FROM manga;

-- insert manga service relations
INSERT INTO manga_service (manga_id, service_id, disabled, last_check, title_id, next_update, latest_chapter, latest_decimal) VALUES (1, 1, false, '2020-08-05 15:34:01.427921', '100010', '2020-08-10 16:00:00.000000', null, null);
INSERT INTO manga_service (manga_id, service_id, disabled, last_check, title_id, next_update, latest_chapter, latest_decimal) VALUES (1, 2, true, '2020-04-06 13:05:33.853545', '20882', null, null, null);
INSERT INTO manga_service (manga_id, service_id, disabled, last_check, title_id, next_update, latest_chapter, latest_decimal) VALUES (4, 1, false, NULL, '100072', null, null, null);


-- insert chapters
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group", group_id) VALUES (1, 1, 1, 'Z=1: Stone World', 1, null, '2020-05-24 14:24:12.320726+00', '1000310', 'Shueisha', 1);
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group", group_id) VALUES (2, 1, 1, 'Z=2: Fantasy vs. Science', 2, null, '2020-05-24 14:24:12.320726+00', '1000311', 'Shueisha', 1);
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group", group_id) VALUES (3, 1, 1, 'Z=3: King of the Stone World', 3, null, '2020-05-24 14:24:12.320726+00', '1000312', 'Shueisha', 1);
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group", group_id) VALUES (4, 1, 1, 'Z=138: End of Part 3', 138, null, '2020-05-24 14:24:12.320726+00', '1006278', 'Shueisha', 1);
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group", group_id) VALUES (5, 1, 1, 'Z=139: First Dream', 139, null, '2020-05-24 14:24:12.320726+00', '1006279', 'Shueisha', 1);
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group", group_id) VALUES (6, 1, 1, 'Z=140: New World Pilots', 140, null, '2020-05-24 14:24:12.320726+00', '1006280', 'Shueisha', 1);
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group", group_id) VALUES (7, 1, 1, 'Z=141: First Team', 141, null, '2020-05-24 14:24:12.320726+00', '1006412', 'Shueisha', 1);
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group", group_id) VALUES (122, 1, 1, 'Z=142: World Power', 142, null, '2020-05-24 14:24:12.320726+00', '1006413', 'Shueisha', 1);
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group", group_id) VALUES (884, 1, 1, 'Z=143: Ryusui vs. Senku', 143, null, '2020-05-24 14:24:12.320726+00', '1006414', 'Shueisha', 1);
INSERT INTO chapters (chapter_id, manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group", group_id) VALUES (1010, 1, 2, 'Chapter 142', 142, null, '2020-05-24 14:24:12.320726+00', '823275', 'MangaPlus', 1);
SELECT setval(pg_get_serial_sequence('chapters', 'chapter_id'), MAX(chapter_id)) FROM chapters;

--insert manga info
INSERT INTO manga_info (manga_id, cover, status, bw, mu, mal, amz, ebj, engtl, raw, nu, kt, ap, al, last_updated) VALUES (1, 'https://uploads.mangadex.org/covers/cfc3d743-bd89-48e2-991f-63e680cc4edf/aec7b5ae-dfce-46a2-bc47-2a1cc8f7fa8b.jpg', 0, 'series/114645', '139601', '103897', 'https://www.amazon.co.jp/gp/product/B075F8JBQ1', 'https://www.ebookjapan.jp/ebj/413780/', 'https://www.viz.com/dr-stone', null, null, '38860', 'dr-stone', '98416', '2020-06-28 11:15:55.170446');
INSERT INTO manga_info (manga_id, cover, status, bw, mu, mal, amz, ebj, engtl, raw, nu, kt, ap, al, last_updated) VALUES (2, 'https://uploads.mangadex.org/covers/cfc3d743-bd89-48e2-991f-63e680cc4edf/aec7b5ae-dfce-46a2-bc47-2a1cc8f7fa8b.jpg', 0, 'series/114645', '139601', '103897', 'https://www.amazon.co.jp/gp/product/B075F8JBQ1', 'https://www.ebookjapan.jp/ebj/413780/', 'https://www.viz.com/dr-stone', null, null, '38860', 'dr-stone', '98416', '2020-06-28 11:15:55.170446');

-- insert users
INSERT INTO users (user_id, username, email, pwhash, user_uuid, joined_at, admin, theme, is_credentials_account) VALUES (1, 'test ci admin', 'test-admin@test.com', crypt('te!st-pa#ss)wo(rd123', gen_salt('bf')), '22fc15c9-37b9-4869-af86-b334333dedd8', '2020-07-08 12:00:00.344806', true, 'dark'::theme, true);
INSERT INTO users (user_id, username, email, pwhash, user_uuid, joined_at, admin, theme, is_credentials_account) VALUES (3, 'test ci', 'test@test.com', crypt('te!st-pa#ss)wo(rd123', gen_salt('bf')), 'cf5eddfd-e0fe-4e6e-b339-70be6f33794d', '2020-07-08 12:00:00.344806', false, 'dark'::theme, true);
INSERT INTO users (user_id, username, email, pwhash, user_uuid, joined_at, admin, theme, is_credentials_account) VALUES (4, 'test ci auth', 'test_auth@test.com', crypt('te!st-pa#ss)wo(rd123', gen_salt('bf')), 'db598f65-c558-4205-937f-b0f149dda1fa', '2020-07-08 12:00:00.344806', false, 'dark'::theme, true);

INSERT INTO users (user_id, username, email, pwhash, user_uuid, joined_at, admin, theme, is_credentials_account) VALUES (5, 'test oauth', 'test@oauth.com', NULL, 'd1e3395a-37fa-4df7-8441-46d2b2689788', '2020-07-08 12:00:00.344806', false, 'dark'::theme, false);
INSERT INTO account (id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state, user_id) VALUES (uuid_generate_v4(), 'test', 'test', 'test', 'test', NULL, 100, NULL, 'test', NULL, NULL, 'd1e3395a-37fa-4df7-8441-46d2b2689788');

SELECT setval(pg_get_serial_sequence('users', 'user_id'), MAX(user_id)) FROM users;

-- insert follows
INSERT INTO user_follows (manga_id, service_id, user_id) VALUES (1, 1, 1);
INSERT INTO user_follows (manga_id, service_id, user_id) VALUES (1, 2, 3);
INSERT INTO user_follows (manga_id, service_id, user_id) VALUES (1, 1, 3);
INSERT INTO user_follows (manga_id, service_id, user_id) VALUES (4, 1, 3);
INSERT INTO user_follows (manga_id, service_id, user_id) VALUES (1, NULL, 3);
