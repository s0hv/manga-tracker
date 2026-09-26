CREATE OR REPLACE FUNCTION merge_manga(base INT, to_merge INT)
    RETURNS TABLE (alias_count INT, chapter_count INT) AS
$$
DECLARE
    alias_count int;
    chapter_count int;
BEGIN
    UPDATE chapters SET manga_id=base WHERE manga_id=to_merge;
    GET DIAGNOSTICS chapter_count = ROW_COUNT;

    UPDATE manga_service SET manga_id=base WHERE manga_id=to_merge;
    UPDATE manga_info SET manga_id=base WHERE manga_id=to_merge;

    INSERT INTO manga_alias SELECT base, title FROM manga WHERE manga_id=to_merge;
    UPDATE manga_alias SET manga_id=base WHERE manga_id=to_merge;
    GET DIAGNOSTICS alias_count = ROW_COUNT;

    UPDATE user_follows SET manga_id=base WHERE manga_id=to_merge;

    -- Merge the manga rows
    WITH old AS (
        SELECT latest_release, latest_chapter FROM manga WHERE manga_id=to_merge
    )
    UPDATE manga SET latest_release=GREATEST(latest_release, (SELECT latest_release FROM old)),
                     latest_chapter=GREATEST(latest_chapter, (SELECT latest_chapter FROM old))
    WHERE manga_id=base;

    DELETE FROM manga WHERE manga_id=to_merge;

    RETURN QUERY SELECT alias_count, chapter_count;
END;
$$ LANGUAGE plpgsql;
