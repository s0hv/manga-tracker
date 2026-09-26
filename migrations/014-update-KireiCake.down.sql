UPDATE service_whole SET feed_url='https://kireicake.com/feed/' WHERE service_id=7;
UPDATE service_config SET scheduled_runs_enabled=FALSE WHERE service_id=7;
UPDATE services SET
                    manga_url_format='https://kireicake.com/projects/{}',
                    chapter_url_format='https://kireicake.com/?p={}'
WHERE service_id=7
