INSERT INTO services
    (service_id, service_name, url, disabled, last_check, chapter_url_format,
     disabled_until, manga_url_format)
VALUES (9, 'Azuki', 'https://www.azuki.co', FALSE, NULL, 'https://www.azuki.co/series/{title_id}/read/{}', NULL, 'https://www.azuki.co/series/{}');

INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id)
VALUES (9, 'https://www.azuki.co/release-calendar', NULL, NULL, NULL);

INSERT INTO service_config (service_id, check_interval, scheduled_run_limit, scheduled_runs_enabled, scheduled_run_interval)
VALUES (9, '1 hour'::interval, 3, TRUE, '1 hour'::interval);
