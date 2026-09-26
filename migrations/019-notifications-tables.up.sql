CREATE TABLE notification_types (
    type_id INT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE notification_fields (
    field_id SERIAL PRIMARY KEY,
    notification_type INT REFERENCES notification_types(type_id) NOT NULL,
    name TEXT NOT NULL,
    optional BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX notification_fields_unique_constraint ON notification_fields(notification_type, name);

CREATE TABLE user_notifications (
    notification_id SERIAL PRIMARY KEY,
    notification_type INT NOT NULL REFERENCES notification_types(type_id),
    user_id INT REFERENCES users(user_id) NOT NULL,
    times_run INT NOT NULL DEFAULT 0,
    times_failed INT NOT NULL DEFAULT 0,
    failed_in_row INT NOT NULL DEFAULT 0,
    disabled BOOLEAN DEFAULT FALSE,
    created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    use_follows BOOLEAN NOT NULL
);

CREATE TABLE user_notification_fields (
    notification_id INT NOT NULL REFERENCES user_notifications(notification_id),
    field_id INT NOT NULL REFERENCES notification_fields(field_id),
    value TEXT NOT NULL,

    PRIMARY KEY (notification_id, field_id)
);

CREATE TABLE notification_options (
    notification_id INT PRIMARY KEY REFERENCES user_notifications(notification_id),
    group_by_manga BOOLEAN NOT NULL DEFAULT FALSE,
    destination TEXT NOT NULL
);

CREATE TABLE notification_manga (
    notification_id INT NOT NULL REFERENCES user_notifications(notification_id),
    manga_id INT NOT NULL REFERENCES manga(manga_id),
    service_id INT REFERENCES services(service_id)
);
CREATE INDEX notification_manga_id_index ON notification_manga(notification_id);
-- We need to indexes since we want to be able to set service_id to null while keeping it unique
CREATE UNIQUE INDEX notification_manga_unique_key
    ON notification_manga (manga_id, notification_id, service_id) WHERE service_id IS NOT NULL;
CREATE UNIQUE INDEX notification_manga_unique_key_null
    ON notification_manga (manga_id, notification_id) WHERE service_id IS NULL;


-- INSERTS
INSERT INTO notification_types (type_id, name)
VALUES (1, 'Discord webhook');

INSERT INTO notification_fields (notification_type, name, optional)
VALUES (1, 'message', TRUE),
       (1, 'embed_title', FALSE),
       (1, 'username', TRUE),
       (1, 'avatar_url', TRUE),
       (1, 'embed_content', FALSE),
       (1, 'url', TRUE),
       (1, 'footer', TRUE),
       (1, 'thumbnail', TRUE),
       (1, 'color', TRUE);
