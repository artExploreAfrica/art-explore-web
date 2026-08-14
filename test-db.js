const { Client } = require('pg');
const c = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
c.connect()
  .then(() => c.query('select 1'))
  .then((r) => {
    console.log('OK', r.rows);
    return c.end();
  })
  .catch((e) => console.error('FAIL:', e.code, e.message));