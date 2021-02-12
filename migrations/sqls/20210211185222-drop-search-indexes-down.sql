/* Replace with your SQL commands */
CREATE INDEX textsearch_fuzzy_title ON manga USING gin (REPLACE(title, '-', ' ') gin_trgm_ops);
CREATE INDEX textsearch_fuzzy_alias_title ON manga_alias USING gin (REPLACE(title, '-', ' ') gin_trgm_ops);
