/* eslint-disable no-unused-vars */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});
client.connect();
const sql = fs.readFileSync(path.join(__dirname, '..', 'database.sql'));

client.query(sql.toString(), [], (err, res) => {
    client.end();
});

