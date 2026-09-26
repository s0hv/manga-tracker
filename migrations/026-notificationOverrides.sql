ALTER TABLE user_notification_fields
    ADD COLUMN override_id INT REFERENCES manga(manga_id) DEFAULT NULL;

ALTER TABLE user_notification_fields
    DROP CONSTRAINT user_notification_fields_pkey;

CREATE UNIQUE INDEX user_notification_fields_unique_key
    ON user_notification_fields (notification_id, field_id, override_id) WHERE override_id IS NOT NULL;
CREATE UNIQUE INDEX user_notification_fields_unique_key_null
    ON user_notification_fields (notification_id, field_id) WHERE override_id IS NULL;
