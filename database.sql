CREATE TABLE manga (
    manga_id            SERIAL PRIMARY KEY,
    title               TEXT NOT NULL,
    release_interval    INTERVAL DEFAULT NULL,
    fixed_interval      BOOL DEFAULT FALSE,
    latest_release      TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX ON manga (manga_id);

CREATE TABLE services (
    service_id          SMALLSERIAL PRIMARY KEY,
    service_name        TEXT NOT NULL,
    url                 TEXT UNIQUE NOT NULL,
    chapter_url_format  TEXT NOT NULL,
    disabled            BOOL NOT NULL DEFAULT FALSE,
    last_check          TIMESTAMP WITH TIME ZONE,
    disabled_until      TIMESTAMP WITH TIME ZONE
);
CREATE INDEX ON services (service_name);
CREATE INDEX ON services (last_check);
CREATE INDEX ON services (disabled_until);


CREATE TABLE manga_service (
    manga_id    INT REFERENCES manga ON DELETE RESTRICT,
    service_id  SMALLINT REFERENCES services ON DELETE RESTRICT,
    url         TEXT NOT NULL,
    title_id    TEXT NOT NULL,
    disabled    BOOL NOT NULL DEFAULT FALSE,
    last_check  TIMESTAMP WITH TIME ZONE,
    next_update TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (manga_id, service_id)
);
CREATE INDEX ON manga_service (last_check);
CREATE INDEX ON manga_service (next_update);


CREATE TABLE service_whole (
    service_id  SMALLINT REFERENCES services ON DELETE RESTRICT,
    feed_url    TEXT UNIQUE NOT NULL,
    last_check  TIMESTAMP WITH TIME ZONE,
    next_update TIMESTAMP WITH TIME ZONE
);
CREATE INDEX ON service_whole (next_update);


CREATE TABLE chapters (
    chapter_id          BIGSERIAL PRIMARY KEY,
    manga_id            INT NOT NULL REFERENCES manga ON DELETE RESTRICT,
    service_id          SMALLINT NOT NULL REFERENCES services ON DELETE RESTRICT,
    title               TEXT NOT NULL,
    chapter_number      INT NOT NULL,
    chapter_decimal     SMALLINT DEFAULT NULL,
    release_date        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    url                 TEXT UNIQUE NOT NULL,
    chapter_identifier  TEXT NOT NULL,
    "group"             TEXT
);
CREATE INDEX ON chapters (title);
CREATE INDEX ON chapters (chapter_number);
CREATE INDEX ON chapters (release_date);
CREATE UNIQUE INDEX ON chapters (service_id, chapter_identifier);

CREATE OR REPLACE FUNCTION merge_manga(base INT, to_merge INT) RETURNS void AS
$$
BEGIN
    UPDATE chapters SET manga_id=base WHERE manga_id=to_merge;
    UPDATE manga_service SET manga_id=base WHERE manga_id=to_merge;
    UPDATE manga SET latest_release=GREATEST(latest_release, (SELECT latest_release FROM manga WHERE manga_id=to_merge)) WHERE manga_id=base;
    DELETE FROM manga WHERE manga_id=to_merge;
END;
$$ LANGUAGE plpgsql
