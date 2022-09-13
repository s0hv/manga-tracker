DROP TABLE auth_tokens, chapters, manga, manga_alias, manga_info, manga_service,
    scheduled_runs, service_whole, services, sessions, user_follows,
    users, authors, "groups", manga_authors, manga_artists, service_config,
    notification_fields, notification_manga, notification_options,
    notification_types, user_notifications, user_notification_fields CASCADE;

TRUNCATE TABLE migrations;
