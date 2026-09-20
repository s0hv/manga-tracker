import { db, sql } from '../index';
import { ServiceForAdminRow, ServiceForApiRow } from '../schemas/services';

export function getServices() {
  return db.many(sql.type(ServiceForAdminRow)`SELECT s.service_id id, service_name, disabled, url, s.last_check,
                    CASE WHEN sw.service_id IS NULL
                        THEN (SELECT MIN(ms.next_update) FROM manga_service ms WHERE ms.service_id=s.service_id)
                        ELSE sw.next_update END as next_update
               FROM services s LEFT JOIN service_whole sw ON s.service_id = sw.service_id
               ORDER BY s.service_id`);
}

export function getServicesForApi() {
  return db.many(sql.type(ServiceForApiRow)`
    SELECT s.service_id,
           service_name as name,
           disabled,
           url,
           s.chapter_url_format,
           s.manga_url_format
    FROM services s`);
}
