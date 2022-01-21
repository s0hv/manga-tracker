INSERT INTO services
    (service_id, service_name, url, disabled, last_check, chapter_url_format,
     disabled_until, manga_url_format)
VALUES (8, 'Comikey', 'https://comikey.com', FALSE, NULL, 'https://comikey.com/read/{}', NULL, 'https://comikey.com/comics/{}');

INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id)
VALUES (8, 'https://comikey.com/sapi/feed.rss', NULL, NULL, NULL);

INSERT INTO service_config (service_id, check_interval, scheduled_run_limit, scheduled_runs_enabled, scheduled_run_interval)
VALUES (8, '1 hour'::interval, 3, TRUE, '1 hour'::interval);
