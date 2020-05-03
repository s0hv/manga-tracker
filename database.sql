CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE manga (
    manga_id            SERIAL PRIMARY KEY,
    title               TEXT NOT NULL,
    release_interval    INTERVAL DEFAULT NULL,
    latest_release      TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    estimated_release   TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    latest_chapter      INT DEFAULT NULL
);
CREATE INDEX textsearch_fuzzy_title ON manga USING gin (title gin_trgm_ops);

CREATE TABLE manga_alias (
    manga_id INT NOT NULL REFERENCES manga ON DELETE CASCADE,
    title TEXT NOT NULL,
    PRIMARY KEY (manga_id, title)
);
CREATE INDEX textsearch_fuzzy_alias_title ON manga_alias USING gin (title gin_trgm_ops);


CREATE TABLE manga_info (
    manga_id    INT REFERENCES manga ON DELETE RESTRICT PRIMARY KEY,
    cover       TEXT DEFAULT NULL,
    status      SMALLINT DEFAULT 0 NOT NULL,

    artist      TEXT DEFAULT NULL,
    author      TEXT DEFAULT NULL,

    -- URLs or ids to different vendors
    bw          TEXT DEFAULT NULL, -- bookwalker
    mu          TEXT DEFAULT NULL, -- Baka-Updates / MangaUpdates
    mal         TEXT DEFAULT NULL, -- MyAnimeList
    amz         TEXT DEFAULT NULL, -- Amazon
    ebj         TEXT DEFAULT NULL, -- eBook Japan
    engtl       TEXT DEFAULT NULL, -- Official English Translation
    raw         TEXT DEFAULT NULL, -- Raw
    nu          TEXT DEFAULT NULL, -- Novel Updates
    kt          TEXT DEFAULT NULL, -- Kitsu
    ap          TEXT DEFAULT NULL, -- Anime-Planet
    al          TEXT DEFAULT NULL  -- AniList
);


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
    manga_id        INT REFERENCES manga ON DELETE RESTRICT,
    service_id      SMALLINT REFERENCES services ON DELETE RESTRICT,
    title_id        TEXT NOT NULL,
    disabled        BOOL NOT NULL DEFAULT FALSE,
    last_check      TIMESTAMP WITH TIME ZONE,
    latest_chapter  INT DEFAULT NULL,
    next_update     TIMESTAMP WITH TIME ZONE,

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
    chapter_identifier  TEXT NOT NULL,
    "group"             TEXT
);
CREATE INDEX ON chapters (title);
CREATE INDEX ON chapters (chapter_number);
CREATE INDEX ON chapters (release_date);
CREATE UNIQUE INDEX ON chapters (service_id, chapter_identifier);

CREATE TABLE users (
    user_id     SERIAL PRIMARY KEY,
    username    VARCHAR(50) NOT NULL,
    email       VARCHAR(100) NOT NULL UNIQUE,
    pwhash      TEXT NOT NULL,  -- max password length 72
    user_uuid   uuid DEFAULT uuid_generate_v4() UNIQUE,  -- used for rss identification
    joined_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dark_theme  BOOL NOT NULL DEFAULT TRUE,
    admin       BOOl DEFAULT FALSE
);

-- table under construction
CREATE TABLE auth_tokens (
    user_id         INT NOT NULL REFERENCES users ON DELETE CASCADE,
    hashed_token    TEXT NOT NULL UNIQUE,
    lookup          TEXT NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, lookup, hashed_token)
);

CREATE TABLE sessions (
    user_id     INT REFERENCES users ON DELETE CASCADE,
    session_id  TEXT PRIMARY KEY,
    expires_at  TIMESTAMP NOT NULL,
    dark_theme  BOOL DEFAULT NULL,
    data        json
);

CREATE OR REPLACE FUNCTION add_user(username VARCHAR(50), email VARCHAR(100), "password" VARCHAR(72))
RETURNS INT AS
$$
DECLARE _user_id INT;
BEGIN
    INSERT INTO users (username, email, pwhash) VALUES (username, email, crypt("password", gen_salt('bf'))) RETURNING user_id INTO _user_id;
    RETURN _user_id;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE user_follows (
    manga_id    INT NOT NULL REFERENCES manga ON DELETE CASCADE,
    service_id  SMALLINT DEFAULT NULL REFERENCES services ON DELETE CASCADE,
    user_id     INT REFERENCES users ON DELETE CASCADE
);

-- We need to indexes since we want to be able to set service_id to null while keeping it unique
CREATE UNIQUE INDEX unique_user_follows_key  ON user_follows (manga_id, user_id, service_id) WHERE service_id IS NOT NULL;
CREATE UNIQUE INDEX unique_user_follows_key2 ON user_follows (manga_id, user_id) WHERE service_id IS NULL;


CREATE OR REPLACE FUNCTION merge_manga(base INT, to_merge INT)
    RETURNS TABLE (alias_count INT, chapter_count INT) AS
$$
DECLARE
    alias_count int;
    chapter_count int;
BEGIN
    UPDATE chapters SET manga_id=base WHERE manga_id=to_merge;
    GET DIAGNOSTICS chapter_count = ROW_COUNT;

    UPDATE manga_service SET manga_id=base WHERE manga_id=to_merge;
    UPDATE manga_info SET manga_id=base WHERE manga_id=to_merge;

    INSERT INTO manga_alias SELECT base, title FROM manga WHERE manga_id=to_merge;
    UPDATE manga_alias SET manga_id=base WHERE manga_id=to_merge;
    GET DIAGNOSTICS alias_count = ROW_COUNT;

    UPDATE user_follows SET manga_id=base WHERE manga_id=to_merge;

    -- Merge the manga rows
    WITH old AS (
        SELECT latest_release, latest_chapter FROM manga WHERE manga_id=to_merge
    )
    UPDATE manga SET latest_release=GREATEST(latest_release, old.latest_release),
                     latest_chapter=GREATEST(latest_chapter, old.latest_chapter)
    WHERE manga_id=base;

    DELETE FROM manga WHERE manga_id=to_merge;

    RETURN QUERY SELECT alias_count, chapter_count;
END;
$$ LANGUAGE plpgsql;
