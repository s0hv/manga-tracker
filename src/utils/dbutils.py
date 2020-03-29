def fuzzy_search_manga(cur, title: str, limit: int=10, return_rows: bool=True):
    """
    Does a fuzzy search of manga and returns the closest matches
    Args:
        cur: The cursor that is being used
        title (str): The query string that the titles are being matched against
        limit (int): A limit on how many rows can be returned. Cannot be None
        return_rows (bool): If set to True will return rows in a list. Otherwise
            will return `cur`

    Returns:
        list or `cur` depending on `return_rows`

    """
    sql = """
        SELECT m.manga_id, m.title, m.latest_release
        FROM manga m 
        LEFT JOIN manga_alias ma on m.manga_id = ma.manga_id
        GROUP BY m.manga_id
        ORDER BY GREATEST(
                        MIN(m.title) ILIKE '%' || %(title)s || '%', 
                    bool_or(ma.title ILIKE '%' || %(title)s || '%')
                 ) DESC,
                 LEAST(MIN(m.title <-> %(title)s), MIN(COALESCE(ma.title <-> %(title)s, 1))) LIMIT %(limit)s
        """

    cur.execute(sql, {'title': title, 'limit': limit})

    if return_rows:
        return cur.fetchall()

    return cur
