UPDATE service_config SET check_interval='2 days'::interval WHERE service_id=1;
UPDATE service_config SET check_interval='15 minutes'::interval WHERE service_id=2;
UPDATE service_config SET check_interval='30 minutes'::interval WHERE service_id=6;

