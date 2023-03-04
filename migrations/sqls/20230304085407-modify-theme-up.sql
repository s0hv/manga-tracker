CREATE TYPE theme AS ENUM ('system', 'light', 'dark');

ALTER TABLE users ALTER COLUMN theme DROP DEFAULT;
ALTER TABLE users
    ALTER COLUMN theme TYPE theme
        USING CASE
            WHEN theme = 1 THEN 'light'::theme
            WHEN theme = 2 THEN 'dark'::theme
            ELSE 'system'::theme
        END;

ALTER TABLE users ALTER COLUMN theme SET DEFAULT 'system'::theme;
