// scripts/db-cli.js
// Утилита для просмотра содержимого SQLite-базы из терминала.
//
// Примеры:
//   node scripts/db-cli.js ".tables"
//   node scripts/db-cli.js "SELECT * FROM rooms"
//   node scripts/db-cli.js "SELECT * FROM bookings WHERE room_id = 1"
//
// Если запрос начинается с точки (.tables, .schema) — выводится как есть.

const db = require('../src/db');

const sql = process.argv.slice(2).join(' ').trim();

if (!sql) {
  console.log('Использование: node scripts/db-cli.js "SQL-запрос"');
  console.log('');
  console.log('Примеры:');
  console.log('  node scripts/db-cli.js ".tables"');
  console.log('  node scripts/db-cli.js "SELECT * FROM rooms"');
  console.log('  node scripts/db-cli.js "SELECT * FROM bookings"');
  process.exit(0);
}

// Псевдокоманды типа .tables — реализуем вручную
if (sql === '.tables') {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);
  console.log(tables.join('  '));
  process.exit(0);
}

try {
  const stmt = db.prepare(sql);
  if (stmt.reader) {
    // SELECT-подобные запросы
    console.table(stmt.all());
  } else {
    // INSERT / UPDATE / DELETE
    const info = stmt.run();
    console.log('OK:', info);
  }
} catch (e) {
  console.error('SQL error:', e.message);
  process.exit(1);
}