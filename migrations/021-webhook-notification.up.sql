INSERT INTO notification_types (type_id, name)
VALUES (2, 'Generic webhook');

INSERT INTO notification_fields (notification_type, name, optional)
VALUES (2, 'json', FALSE);
