-- Modify account table
ALTER TABLE account DROP COLUMN type;
ALTER TABLE account DROP COLUMN refresh_token;
ALTER TABLE account DROP COLUMN access_token;
ALTER TABLE account DROP COLUMN expires_at;
ALTER TABLE account DROP COLUMN token_type;
ALTER TABLE account DROP COLUMN scope;
ALTER TABLE account DROP COLUMN id_token;
ALTER TABLE account DROP COLUMN session_state;
ALTER TABLE account DROP COLUMN id;

ALTER TABLE account DROP CONSTRAINT account_user_id_fkey;

ALTER TABLE account ADD COLUMN user_id_new INT;

UPDATE account
SET user_id_new = users.user_id
FROM users
WHERE users.user_uuid = account.user_id;

ALTER TABLE account ALTER COLUMN user_id_new SET NOT NULL;
ALTER TABLE account DROP COLUMN user_id;
ALTER TABLE account RENAME COLUMN user_id_new TO user_id;

DROP INDEX account_provider_account_id_provider_idx;
CREATE UNIQUE INDEX ux_account_provider_account_id_user_id
  ON account (provider, provider_account_id, user_id);

-- Modify users table
ALTER TABLE users
    ALTER COLUMN username SET NOT NULL;

ALTER TABLE users DROP COLUMN email_verified;
ALTER TABLE users DROP COLUMN is_credentials_account;

-- Modify sessions table
TRUNCATE TABLE sessions;

ALTER TABLE sessions DROP COLUMN delete_user;

ALTER TABLE sessions
    DROP CONSTRAINT sessions_user_id_fkey;

ALTER TABLE sessions
    ALTER COLUMN user_id TYPE INT USING 0;

ALTER TABLE sessions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE sessions
  ADD session_secret BYTEA NOT NULL;

ALTER TABLE sessions
  ADD CONSTRAINT fk_sessions_user_id
    FOREIGN KEY (user_id) REFERENCES users (user_id)
      ON DELETE CASCADE;

-- Recreate auth_token table for "remember me" logic
CREATE TABLE auth_token
(
  user_id    INT                      NOT NULL
    CONSTRAINT fk_auth_token_user_id REFERENCES users
      ON DELETE CASCADE,
  token_hash BYTEA                    NOT NULL UNIQUE,
  lookup     TEXT                     NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (user_id, lookup)
);

