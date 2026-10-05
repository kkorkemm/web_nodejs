require('dotenv').config();

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './data.db';
const ABS_DB_PATH = path.resolve(DB_PATH);

fs.mkdirSync(path.dirname(ABS_DB_PATH), { recursive: true });

const db = new Database(ABS_DB_PATH);
db.pragma('journal_mode = WAL');   // параллельное чтение при записи
db.pragma('foreign_keys = ON');    // включаем проверку внешних ключей

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT NOT NULL,
    email  TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    capacity  INTEGER NOT NULL CHECK (capacity > 0),
    floor     INTEGER NOT NULL,
    equipment TEXT    NOT NULL DEFAULT '[]'  -- JSON-массив строк
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id     INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time  TEXT    NOT NULL,             -- ISO 8601 UTC
    end_time    TEXT    NOT NULL,
    topic       TEXT    NOT NULL,
    series_id   TEXT,                         -- общий id для серии повторов
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_room_time
    ON bookings(room_id, start_time, end_time);
`);

const seed = db.transaction(() => {
  const roomsCount = db.prepare('SELECT COUNT(*) AS c FROM rooms').get().c;
  if (roomsCount === 0) {
    const ins = db.prepare(
      'INSERT INTO rooms (name, capacity, floor, equipment) VALUES (?, ?, ?, ?)'
    );
    ins.run('Конференц-зал', 100, 3, JSON.stringify(['проектор', 'видеоконференцсвязь', 'круглый стол', 'микрофоны']));
    ins.run('Учебный зал',  20, 3, JSON.stringify(['ТВ', '10 столов', 'доска']));
    ins.run('Читальный зал', 20, 5, JSON.stringify(['книжные стелажи', 'ТВ', 'доска', 'столы']));
  }

  const usersCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (usersCount === 0) {
    const ins = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    ins.run('Коркем Жардемова',   'korkem@mail.ru');
    ins.run('Амина Искакова', 'amina@mail.ru');
    ins.run('Олеся Перфильева',  'olesya@mail.ru');
    ins.run('Александр Хорошилов',  'sasha@mail.ru');
  }
});
seed();

module.exports = db;