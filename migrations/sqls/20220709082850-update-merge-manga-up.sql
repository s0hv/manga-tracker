CREATE OR REPLACE FUNCTION merge_manga(base INT, to_merge INT, merged_service_id INT DEFAULT NULL)
    RETURNS TABLE (alias_count INT, chapter_count INT) AS
$$
DECLARE
    alias_count int;
    chapter_count int;
    old_title text;
BEGIN
    IF base IS NULL OR to_merge IS NULL
    THEN
        RAISE EXCEPTION 'base and to_merge must not be NULL';
    END IF;

    -- If only merged manga only has a single service merge it completely
    IF merged_service_id IS NOT NULL AND (SELECT COUNT(*) = 1 FROM manga_service WHERE manga_id=to_merge)
    THEN
        merged_service_id := NULL;
    END IF;

    -- Merge chapters
    IF merged_service_id IS NULL
    THEN
        UPDATE chapters SET manga_id=base WHERE manga_id=to_merge;
    ELSE
        UPDATE chapters SET manga_id=base WHERE manga_id=to_merge AND service_id=merged_service_id;
    END IF;
    GET DIAGNOSTICS chapter_count = ROW_COUNT;

    IF merged_service_id IS NULL
    THEN
        -- Delete rows that already have an entry with the new id
        DELETE FROM manga_service
        WHERE manga_id=to_merge AND
              service_id in (SELECT service_id FROM manga_service WHERE manga_id=base);

        UPDATE manga_service SET manga_id=base WHERE manga_id=to_merge;
    ELSE
        -- If base manga already exists then just delete the merged manga. Otherwise update the table
        IF EXISTS(SELECT service_id FROM manga_service WHERE service_id=merged_service_id AND manga_id=base)
        THEN
            DELETE FROM manga_service WHERE manga_id=to_merge AND service_id=merged_service_id;
        ELSE
            UPDATE manga_service SET manga_id=base WHERE service_id=merged_service_id AND manga_id=to_merge;
        END IF;
    END IF;

    -- Only merge manga info if service id was not given
    -- This is because the usual reason for a service specific merge is
    -- manga misclassification
    IF merged_service_id IS NULL
    THEN
        -- Check if both have their own manga info entries
        IF (SELECT count(*)=2 FROM manga_info WHERE manga_id=base OR manga_id=to_merge) THEN
            RAISE NOTICE 'Merging manga info of % into %', to_merge, base;
            UPDATE manga_info mi
            SET
                cover=COALESCE(mi.cover, t.cover)
            FROM (SELECT cover FROM manga_info WHERE manga_id=to_merge) as t
            WHERE manga_id=base;
            -- Delete row after merging it
            DELETE FROM manga_info WHERE manga_id=to_merge;
        ELSE
            UPDATE manga_info SET manga_id=base WHERE manga_id=to_merge;
        END IF;
    END IF;

    -- Only transfer artist and author when merging all services
    IF merged_service_id IS NULL
    THEN
        -- artists
        IF NOT EXISTS(SELECT 1 FROM manga_artists WHERE manga_id=base)
        THEN
            UPDATE manga_artists SET manga_id=base WHERE manga_id=to_merge;
        ELSE
            DELETE FROM manga_artists WHERE manga_id=to_merge;
        END IF;

        -- authors
        IF NOT EXISTS(SELECT 1 FROM manga_authors WHERE manga_id=base)
        THEN
            UPDATE manga_authors SET manga_id=base WHERE manga_id=to_merge;
        ELSE
            DELETE FROM manga_authors WHERE manga_id=to_merge;
        END IF;
    END IF;

    -- Do not merge titles if service id given. Reason same as above
    IF merged_service_id IS NULL
    THEN
        SELECT title INTO old_title FROM manga WHERE manga_id=to_merge;
        INSERT INTO manga_alias VALUES (base, old_title) ON CONFLICT DO NOTHING;

        -- Update entries that do not already exist. Delete duplicates
        UPDATE manga_alias SET manga_id=base
        WHERE manga_id=to_merge AND title NOT IN (SELECT title FROM manga_alias WHERE manga_id=base);
        GET DIAGNOSTICS alias_count = ROW_COUNT;

        DELETE FROM manga_alias WHERE manga_id=to_merge;

    ELSE
        SELECT 0 INTO alias_count;
    END IF;

    IF merged_service_id IS NULL
    THEN
        UPDATE user_follows SET manga_id=base WHERE manga_id=to_merge;
    ELSE
        UPDATE user_follows SET manga_id=base WHERE manga_id=to_merge AND service_id=merged_service_id;
    END IF;

    IF merged_service_id IS NULL
    THEN
        UPDATE notification_manga SET manga_id=base WHERE manga_id=to_merge;
    ELSE
        UPDATE notification_manga SET manga_id=base WHERE manga_id=to_merge AND service_id=merged_service_id;
    END IF;

    -- Just delete any scheduled runs associated with the merged manga
    DELETE FROM scheduled_runs WHERE manga_id=to_merge;

    -- No need to merge manga rows for single service merges
    IF merged_service_id IS NULL
    THEN
        -- Merge the manga rows
        WITH old AS (
            SELECT latest_release, latest_chapter, views FROM manga WHERE manga_id=to_merge
        )
        UPDATE manga SET latest_release=GREATEST(latest_release, (SELECT latest_release FROM old)),
                         latest_chapter=GREATEST(latest_chapter, (SELECT latest_chapter FROM old)),
                         views=views + (SELECT views FROM old)
        WHERE manga_id=base;
        DELETE FROM manga WHERE manga_id=to_merge;
    END IF;

    RETURN QUERY SELECT alias_count, chapter_count;
END;
$$ LANGUAGE plpgsql;
