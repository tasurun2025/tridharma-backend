// backend/migrate.js
const fs = require('fs');
const { openDb } = require('./db');
(async ()=>{
  const sql = fs.readFileSync('./migrations.sql','utf8');
  const db = await openDb();
  await db.exec(sql);
  console.log('Migrations executed');
  process.exit(0);
})();
