web: node --enable-source-maps /app/web/dist/server.js
release: cd /app && node ./node_modules/db-migrate/bin/db-migrate --config migrations-config.json up
