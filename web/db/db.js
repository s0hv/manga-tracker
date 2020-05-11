const pool = require('.');

function getLatestReleases(service_id, manga_id, user_uuid) {
    const joins = [];
    const where = [];
    const args = [];
    let paramNumber = 1;
    if (user_uuid) {
        joins.push(`INNER JOIN user_follows uf ON c.manga_id = uf.manga_id AND (uf.service_id IS NULL OR c.service_id=uf.service_id) 
                    INNER JOIN users u ON u.user_id=uf.user_id`);
        where.push(`u.user_uuid=$${paramNumber}::uuid`);
        args.push(user_uuid);
        paramNumber++;
    }

    if (manga_id) {
        where.push(`c.manga_id=$${paramNumber}`);
        args.push(manga_id);
        paramNumber++;
    }

    if (service_id) {
        where.push(`c.service_id=$${paramNumber}`);
        args.push(service_id);
        paramNumber++;
    }

    const sql = `
        WITH chapters_filtered AS (
            SELECT chapter_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, c.service_id, c.manga_id 
            FROM chapters c ${joins.join(' ')}
            ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
            ORDER BY release_date DESC, chapter_number DESC
        )
        SELECT c.chapter_id, m.title as manga_title, m.manga_id, m.release_interval, c.title, c.chapter_number, c.chapter_decimal, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url
        FROM chapters_filtered c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id 
        WHERE c.release_date > NOW() - INTERVAL '1 hour'
        UNION 
              (SELECT c.chapter_id, m.title as manga_title, m.manga_id, m.release_interval, c.title, c.chapter_number, c.chapter_decimal, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url
              FROM chapters_filtered c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id
              LIMIT 30)
        ORDER BY release_date DESC, chapter_number DESC`;

    return pool.query(sql, args);
}

function getUserFollows(user_id, manga_id) {
    const sql = `SELECT service_id FROM user_follows WHERE user_id=$1 AND manga_id=$2`;
    return pool.query(sql, [user_id, manga_id]);
}

module.exports = { getLatestReleases, getUserFollows }