UPDATE service_whole SET feed_url='https://reader.kireicake.com/reader' WHERE service_id=7;
UPDATE service_config SET scheduled_runs_enabled=TRUE WHERE service_id=7;
UPDATE services SET
                    manga_url_format='https://reader.kireicake.com/series/{}',
                    chapter_url_format='https://reader.kireicake.com/read/{}'
WHERE service_id=7
