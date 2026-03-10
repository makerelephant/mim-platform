// Temporary migration runner — delete after migration is complete
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.DATABASE_URL ||
  'postgresql://postgres.smychxtekmfzezirpubp:' + process.env.DB_PASSWORD + '@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

async function runSql(sql, label) {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log(`\n=== ${label || 'Query'} ===`);
    const result = await client.query(sql);
    if (Array.isArray(result)) {
      // Multiple statements
      result.forEach((r, i) => {
        if (r.rows && r.rows.length > 0) {
          console.log(`Statement ${i + 1}: ${r.rowCount} rows`);
          console.log(JSON.stringify(r.rows.slice(0, 50), null, 2));
        } else {
          console.log(`Statement ${i + 1}: OK (${r.command} ${r.rowCount || ''})`);
        }
      });
    } else if (result.rows && result.rows.length > 0) {
      console.log(`${result.rowCount} rows returned:`);
      console.log(JSON.stringify(result.rows, null, 2));
    } else {
      console.log(`OK (${result.command} ${result.rowCount || ''})`);
    }
    return result;
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    throw err;
  } finally {
    await client.end();
  }
}

async function runFile(filepath, label) {
  const sql = fs.readFileSync(filepath, 'utf8');
  return runSql(sql, label || path.basename(filepath));
}

// If called directly with a file argument
if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.log('Usage: DB_PASSWORD=xxx node run-sql.cjs <file.sql | "SQL STRING">');
    process.exit(1);
  }
  const isFile = fs.existsSync(arg);
  (isFile ? runFile(arg) : runSql(arg, 'inline'))
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runSql, runFile };
