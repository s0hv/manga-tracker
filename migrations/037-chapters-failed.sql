CREATE TABLE chapters_failed
(
  chapter_identifier TEXT     NOT NULL,

  service_id         SMALLINT NOT NULL
    CONSTRAINT chapters_failed_service_id_fkey
      REFERENCES public.services
      ON DELETE CASCADE,


  manga_id           INTEGER
    CONSTRAINT chapters_failed_manga_id_fkey
      REFERENCES manga
      ON DELETE CASCADE,

  errors             TEXT     NOT NULL,
  title              TEXT,
  chapter_number     INTEGER,
  chapter_decimal    SMALLINT,
  title_id           TEXT,
  manga_title        TEXT,
  release_date       TIMESTAMP WITH TIME ZONE,
  "group"            TEXT,
  timestamp          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  PRIMARY KEY (service_id, chapter_identifier)
);
