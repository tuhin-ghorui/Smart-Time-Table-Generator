/* Loads database/schema.sql into MySQL (creates the campustime database).
 * Usage: npm run db:schema
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  await conn.query(sql);
  await conn.end();
  console.log('Schema loaded successfully into database:', process.env.DB_NAME || 'campustime');
}

main().catch((err) => {
  console.error('Failed to load schema:', err.message);
  console.error('Check your .env DB credentials and that MySQL is running.');
  process.exit(1);
});