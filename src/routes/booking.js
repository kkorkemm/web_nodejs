const express = require('express');
const db = require('../db');

const router = express.Router();

const selectBookingFull = db.prepare(`
  SELECT b.*, r.name AS room_name, u.name AS user_name
  FROM bookings b
  JOIN rooms r ON r.id = b.room_id
  JOIN users u ON u.id = b.user_id
  WHERE b.id = ?
`);

const selectAll = db.prepare(`
  SELECT b.*, r.name AS room_name, u.name AS user_name
  FROM bookings b
  JOIN rooms r ON r.id = b.room_id
  JOIN users u ON u.id = b.user_id
  ORDER BY b.start_time
`);

const insertBooking = db.prepare(`
  INSERT INTO bookings (room_id, user_id, start_time, end_time, topic)
  VALUES (@room_id, @user_id, @start_time, @end_time, @topic)
`);

const getRoom = db.prepare('SELECT * FROM rooms WHERE id = ?');
const getUser = db.prepare('SELECT * FROM users WHERE id = ?');

// Принимаем ISO-строку, возвращаем ISO-строку в UTC.
// Бросаем ошибку с кодом 400, если дата не парсится.
function toISO(value, fieldName) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`Некорректное значение ${fieldName}: ${value}`);
    err.status = 400;
    throw err;
  }
  return d.toISOString();
}

// GET /api/bookings : все брони
router.get('/', (_req, res) => {
  res.json(selectAll.all());
});

// GET /api/bookings/:id : одна бронь
router.get('/:id', (req, res) => {
  const booking = selectBookingFull.get(Number(req.params.id));
  if (!booking) return res.status(404).json({ error: 'Бронь не найдена' });
  res.json(booking);
});

// POST /api/bookings : создать бронь
router.post('/', (req, res) => {
  const { roomId, userId, startTime, endTime, topic } = req.body || {};

  // Проверка наличия обязательных полей
  if (!roomId || !userId || !startTime || !endTime || !topic) {
    return res.status(400).json({
      error: 'Обязательные поля: roomId, userId, startTime, endTime, topic',
    });
  }

  // Проверка, что комнаты и пользователи существуют
  const room = getRoom.get(Number(roomId));
  if (!room) return res.status(404).json({ error: 'Комната не найдена' });

  const user = getUser.get(Number(userId));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  // Нормализация дат
  let startISO, endISO;
  try {
    startISO = toISO(startTime, 'startTime');
    endISO   = toISO(endTime,   'endTime');
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }

  if (new Date(endISO) <= new Date(startISO)) {
    return res.status(400).json({ error: 'endTime должен быть позже startTime' });
  }

  const info = insertBooking.run({
    room_id:    Number(roomId),
    user_id:    Number(userId),
    start_time: startISO,
    end_time:   endISO,
    topic:      String(topic),
  });

  const created = selectBookingFull.get(info.lastInsertRowid);
  res.status(201).json(created);
});

module.exports = router;