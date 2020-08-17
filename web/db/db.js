const pool = require('.');

function getLatestReleases(serviceId, mangaId, userUUID) {
    const joins = [];
    const where = [];
    const args = [];
    let paramNumber = 1;
    if (userUUID) {
        joins.push(`INNER JOIN user_follows uf ON c.manga_id = uf.manga_id AND (uf.service_id IS NULL OR c.service_id=uf.service_id) 
                    INNER JOIN users u ON u.user_id=uf.user_id`);
        where.push(`u.user_uuid=$${paramNumber}::uuid`);
        args.push(userUUID);
        paramNumber++;
    }

    if (mangaId) {
        where.push(`c.manga_id=$${paramNumber}`);
        args.push(mangaId);
        paramNumber++;
    }

    if (serviceId) {
        where.push(`c.service_id=$${paramNumber}`);
        args.push(serviceId);
        paramNumber++;
    }

    const sql = `
        WITH chapters_filtered AS (
            SELECT chapter_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, c.service_id, c.manga_id, c."group"
            FROM chapters c ${joins.join(' ')}
            ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
        )
        SELECT c.chapter_id, m.title as manga_title, m.manga_id, m.release_interval, c.title, c.chapter_number, c.chapter_decimal, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url, c."group"
        FROM chapters_filtered c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id 
        WHERE c.release_date > NOW() - INTERVAL '1 hour'
        UNION 
              (SELECT c.chapter_id, m.title as manga_title, m.manga_id, m.release_interval, c.title, c.chapter_number, c.chapter_decimal, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url, c."group"
              FROM chapters_filtered c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id
              ORDER BY release_date DESC, chapter_number DESC
              LIMIT 30)
        ORDER BY release_date DESC, chapter_number DESC`;

    return pool.query(sql, args);
}

function getUserFollows(userId, mangaId) {
    const sql = 'SELECT service_id FROM user_follows WHERE user_id=$1 AND manga_id=$2';
    return pool.query(sql, [userId, mangaId]);
}

module.exports = { getLatestReleases, getUserFollows };
