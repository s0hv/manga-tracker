-- Copies the history of db-migrate, which was used before node-pg-migrate, so that
-- already applied migrations are not run again. migrate.mjs runs this migration on
-- its own before the others, because node-pg-migrate reads the history only once per run.
DO $$
BEGIN
  IF to_regclass('migrations') IS NULL THEN
    RETURN;
  END IF;

  -- Copy run migrations from db-migrate to node-pg-migrate
  INSERT INTO pgmigrations (id, name, run_on)
  SELECT nextval('pgmigrations_id_seq'::regclass), renamed.new_name, migrations.run_on
  FROM migrations
  -- db-migrate stored names with a path prefix, such as "/20200725150305-createDb"
  JOIN (VALUES
    ('20200725150305-createDb', '001-createDb'),
    ('20200725150355-createServices', '002-createServices'),
    ('20200913115934-disableJaiminisBox', '003-disableJaiminisBox'),
    ('20201003132854-addMangaServiceFeedUrl', '004-addMangaServiceFeedUrl'),
    ('20201008110445-addMissingIndexes', '005-addMissingIndexes'),
    ('20201013144511-updateMergeManga', '006-updateMergeManga'),
    ('20201108141847-createTable-scheduled-runs', '007-createTable-scheduled-runs'),
    ('20210131171057-manga-views', '008-manga-views'),
    ('20210211185222-drop-search-indexes', '009-drop-search-indexes'),
    ('20210216151728-release-date-not-null', '010-release-date-not-null'),
    ('20210424194638-notNull-chapters', '011-notNull-chapters'),
    ('20210503152822-updateMergeManga-serviceParam', '012-updateMergeManga-serviceParam'),
    ('20210511092305-add_service_config', '013-add_service_config'),
    ('20210514141855-update-KireiCake', '014-update-KireiCake'),
    ('20210603192618-createTable-authors-and-groups', '015-createTable-authors-and-groups'),
    ('20210613151016-add-manga-service-service-id-title-id-key', '016-add-manga-service-service-id-title-id-key'),
    ('20210707161003-update-check-intervals', '017-update-check-intervals'),
    ('20220120193943-add-service-comikey', '018-add-service-comikey'),
    ('20220320143953-notifications-tables', '019-notifications-tables'),
    ('20220328100417-add-notification-name', '020-add-notification-name'),
    ('20220402181715-webhook-notification', '021-webhook-notification'),
    ('20220608202021-add-service-azuki', '022-add-service-azuki'),
    ('20220709082850-update-merge-manga', '023-update-merge-manga'),
    ('20220709184553-add-timezones', '024-add-timezones'),
    ('20221221130555-reset-service-counter', '025-reset-service-counter'),
    ('20230115212808-notificationOverrides', '026-notificationOverrides'),
    ('20230205105701-update-mangaplus-api', '027-update-mangaplus-api'),
    ('20230226205448-next-auth-tables', '028-next-auth-tables'),
    ('20230304085407-modify-theme', '029-modify-theme'),
    ('20230305082633-user-deletion', '030-user-deletion'),
    ('20230819201806-fix-session-expiry', '031-fix-session-expiry'),
    ('20250621185345-add-comick', '032-add-comick'),
    ('20250723105224-add-cubari', '033-add-cubari'),
    ('20250726113624-fix-comick-chapter-url', '034-fix-comick-chapter-url'),
    ('20251109171101-add-kmanga', '035-add-kmanga'),
    ('20251221192011-remove-next-auth', '036-remove-next-auth'),
    ('20260807121344-chapters-failed', '037-chapters-failed'),
    ('20260817161458-notification-sent-column', '038-notification-sent-column')
  ) AS renamed (old_name, new_name) ON regexp_replace(migrations.name, '^.*/', '') = renamed.old_name
  ORDER BY 1;

  DROP TABLE migrations;
END $$;
