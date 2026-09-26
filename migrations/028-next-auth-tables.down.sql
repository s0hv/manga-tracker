DROP TABLE account;

ALTER TABLE users
    ALTER COLUMN username SET NOT NULL;

ALTER TABLE users
    ALTER COLUMN pwhash SET NOT NULL;

ALTER TABLE users DROP COLUMN email_verified;
ALTER TABLE users DROP COLUMN is_credentials_account;


TRUNCATE TABLE sessions;

ALTER TABLE sessions
    DROP CONSTRAINT sessions_user_id_fkey;

ALTER TABLE sessions
    ALTER COLUMN user_id TYPE INT USING 0;

ALTER TABLE sessions
    ADD FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON DELETE CASCADE;

CREATE TABLE auth_tokens (
    user_id         INT NOT NULL REFERENCES users ON DELETE CASCADE,
    hashed_token    TEXT NOT NULL UNIQUE,
    lookup          TEXT NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, lookup, hashed_token)
);
