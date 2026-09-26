CREATE OR REPLACE FUNCTION merge_manga(base INT, to_merge INT)
    RETURNS TABLE (alias_count INT, chapter_count INT) AS
$$
DECLARE
    alias_count int;
    chapter_count int;
    old_title text;
BEGIN
    UPDATE chapters SET manga_id=base WHERE manga_id=to_merge;
    GET DIAGNOSTICS chapter_count = ROW_COUNT;

    -- Delete rows that already have an entry with the new id
    DELETE FROM manga_service
    WHERE manga_id=to_merge AND
          service_id in (SELECT service_id FROM manga_service WHERE manga_id=base);

    UPDATE manga_service SET manga_id=base WHERE manga_id=to_merge;

    -- Check if both have their own manga info entries
    IF (SELECT count(*)=2 FROM manga_info WHERE manga_id=base OR manga_id=to_merge) THEN
        RAISE NOTICE 'Merging manga info of % into %', to_merge, base;
        UPDATE manga_info mi
        SET
            cover=COALESCE(mi.cover, t.cover),
            artist=COALESCE(mi.artist, t.artist),
            author=COALESCE(mi.author, t.author)
        FROM (SELECT cover, artist, author FROM manga_info WHERE manga_id=to_merge) as t
        WHERE manga_id=base;
        -- Delete row after merging it
        DELETE FROM manga_info WHERE manga_id=to_merge;
    ELSE
        UPDATE manga_info SET manga_id=base WHERE manga_id=to_merge;
    END IF;

    SELECT title INTO old_title FROM manga WHERE manga_id=to_merge;
    INSERT INTO manga_alias VALUES (base, old_title) ON CONFLICT DO NOTHING;
    UPDATE manga_alias SET manga_id=base WHERE manga_id=to_merge AND title != old_title;
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
