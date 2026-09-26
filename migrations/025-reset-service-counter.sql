SELECT setval('services_service_id_seq', (SELECT MAX(service_id) + 1 FROM services), true)
