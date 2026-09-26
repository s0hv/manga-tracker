CREATE TABLE scheduled_runs (
    manga_id INT REFERENCES manga NOT NULL,
    service_id SMALLINT REFERENCES services NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT REFERENCES users (user_id),

    PRIMARY KEY (manga_id, service_id)
);
