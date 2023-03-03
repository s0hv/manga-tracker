-- based on models of default adapters
-- https://github.com/nextauthjs/next-auth/tree/5d1c35e8aa1fa039d118e77e130aea3504ab06a9/packages

ALTER TABLE users
    ALTER COLUMN username DROP NOT NULL;

ALTER TABLE users
    ALTER COLUMN pwhash DROP NOT NULL;

ALTER TABLE users ADD COLUMN email_verified TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN is_credentials_account BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN is_credentials_account DROP DEFAULT;


TRUNCATE TABLE sessions;

ALTER TABLE sessions
    DROP CONSTRAINT sessions_user_id_fkey;

ALTER TABLE sessions
    ALTER COLUMN user_id TYPE uuid USING (uuid_generate_v4());

ALTER TABLE sessions
    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE sessions
    ADD FOREIGN KEY (user_id) REFERENCES users (user_uuid)
        ON DELETE CASCADE;


CREATE TABLE account (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    provider_account_id TEXT,
    refresh_token TEXT,
    access_token TEXT,
    expires_at int,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    user_id uuid NOT NULL REFERENCES users (user_uuid) ON DELETE CASCADE
);
CREATE UNIQUE INDEX ON account (provider_account_id, "provider");

DROP TABLE auth_tokens;
