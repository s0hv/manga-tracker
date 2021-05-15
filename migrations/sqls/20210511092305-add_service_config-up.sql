CREATE TABLE service_config (
    service_id INT REFERENCES services (service_id) ON DELETE CASCADE PRIMARY KEY,
    check_interval INTERVAL NOT NULL DEFAULT INTERVAL '1 hour',

    scheduled_run_limit SMALLINT NOT NULL DEFAULT 5,
    scheduled_runs_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    scheduled_run_interval INTERVAL NOT NULL DEFAULT INTERVAL '1 hour'
);

ALTER TABLE services ADD COLUMN scheduled_runs_disabled_until TIMESTAMP DEFAULT NULL;

INSERT INTO service_config (service_id) (SELECT service_id FROM services);
UPDATE service_config SET scheduled_run_limit=10, scheduled_run_interval=INTERVAL '10 minutes' WHERE service_id=2;
UPDATE service_config SET scheduled_runs_enabled=FALSE WHERE service_id IN (7, 4);
