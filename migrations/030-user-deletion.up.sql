-- If set to a value near current time account is deleted
ALTER TABLE sessions ADD COLUMN delete_user TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Can be used for automatic deletion of inactive accounts. Inaccurate up to session length
ALTER TABLE users ADD COLUMN last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE user_notifications
    DROP CONSTRAINT user_notifications_user_id_fkey,
    ADD CONSTRAINT user_notifications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE notification_options
    DROP CONSTRAINT notification_options_notification_id_fkey,
    ADD CONSTRAINT notification_options_notification_id_fkey
        FOREIGN KEY (notification_id) REFERENCES user_notifications(notification_id) ON DELETE CASCADE;

ALTER TABLE notification_manga
    DROP CONSTRAINT notification_manga_notification_id_fkey,
    ADD CONSTRAINT notification_manga_notification_id_fkey
        FOREIGN KEY (notification_id) REFERENCES user_notifications(notification_id) ON DELETE CASCADE;

ALTER TABLE user_notification_fields
    DROP CONSTRAINT user_notification_fields_notification_id_fkey,
    ADD CONSTRAINT user_notification_fields_notification_id_fkey
        FOREIGN KEY (notification_id) REFERENCES user_notifications(notification_id) ON DELETE CASCADE;
