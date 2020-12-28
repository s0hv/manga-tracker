const db = require('..');

const updateMangaTitle = (mangaId, newTitle) => {
  const sql = `UPDATE manga
               SET title=$1
               WHERE manga_id=$2
               RETURNING (SELECT title FROM manga WHERE manga_id=$2)`;

  const aliasSql = `UPDATE manga_alias
                    SET title=$1
                    WHERE manga_id=$2 AND title=$3 AND NOT EXISTS(SELECT 1 FROM manga_alias WHERE manga_id=$2 AND title=$1)
                    RETURNING title`;

  return db.query(sql, [newTitle, mangaId])
    .then(res => {
      const row = res.rows[0];

      // If row was not found return undefined
      if (!row) return;

      return db.query(aliasSql, [row.title, mangaId, newTitle]);
    });
};

module.exports = {
  updateMangaTitle,
};
