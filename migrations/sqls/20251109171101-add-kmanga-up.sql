INSERT INTO services (service_id, service_name, url, disabled, last_check, chapter_url_format, disabled_until,
                      manga_url_format)
VALUES (12,
        'KManga',
        'https://kmanga.kodansha.com',
        FALSE,
        NULL,
        'https://kmanga.kodansha.com/title/{title_id}/episode/{}',
        NULL,
        'https://kmanga.kodansha.com/title/{}');

INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id)
VALUES (12, 'https://api.kmanga.kodansha.com', NULL, NULL, NULL);

INSERT INTO service_config (service_id, check_interval, scheduled_run_limit, scheduled_runs_enabled, scheduled_run_interval)
VALUES (12, '6 hours'::INTERVAL, 3, TRUE, '1 hour'::INTERVAL);
