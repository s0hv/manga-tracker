INSERT INTO services (service_id, service_name, url, disabled, last_check, chapter_url_format, disabled_until,
                      manga_url_format)
VALUES (10,
        'Comick',
        'https://comick.io',
        FALSE,
        NULL,
        'https://comick.io/comick/{title_id}/{}',
        NULL,
        'https://comick.io/comic/{}');

INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id)
VALUES (10, 'https://api.comick.fun', NULL, NULL, NULL);

INSERT INTO service_config (service_id, check_interval, scheduled_run_limit, scheduled_runs_enabled, scheduled_run_interval)
VALUES (10, '45 minutes'::INTERVAL, 3, TRUE, '1 hour'::INTERVAL);
