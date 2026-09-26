DROP TABLE chapters, chapters_failed, manga, manga_alias, manga_info, manga_service,
    scheduled_runs, service_whole, services, sessions, user_follows,
    account, auth_token, users, authors, "groups", manga_authors, manga_artists, service_config,
    notification_fields, notification_manga, notification_options,
    notification_types, user_notifications, user_notification_fields CASCADE;

TRUNCATE TABLE pgmigrations;
DROP TYPE theme;
SELECT setval(pg_get_serial_sequence('pgmigrations', 'id'), 1);
