INSERT INTO services (service_id, service_name, url, disabled, last_check, chapter_url_format, disabled_until,
                      manga_url_format)
VALUES (11,
        'Cubari',
        'https://cubari.moe',
        FALSE,
        NULL,
        'https://cubari.moe/read/{title_id}/{}',
        NULL,
        'https://cubari.moe/read/{}');

INSERT INTO service_config (service_id, check_interval, scheduled_run_limit, scheduled_runs_enabled, scheduled_run_interval)
VALUES (11, '1 hour'::INTERVAL, 5, TRUE, '1 hour'::INTERVAL);
