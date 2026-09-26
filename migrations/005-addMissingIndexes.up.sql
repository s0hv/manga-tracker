CREATE INDEX chapters_manga_id_index ON chapters (manga_id);
CREATE INDEX chapters_service_id_index ON chapters (service_id);

CREATE INDEX manga_alias_manga_id_index ON manga_alias (manga_id);

CREATE INDEX manga_info_manga_id_index ON manga_info (manga_id);

CREATE INDEX manga_service_manga_id_index ON manga_service (manga_id);

CREATE INDEX user_follows_user_id_index ON user_follows (user_id)
