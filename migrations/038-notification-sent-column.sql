ALTER TABLE chapters
  ADD COLUMN is_notification_sent BOOLEAN NOT NULL
    CONSTRAINT df_chapters__notification_sent DEFAULT FALSE;

-- All existing chapters should have had their notifications sent so
-- we can set the value to true
UPDATE chapters SET is_notification_sent = true;
