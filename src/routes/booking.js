const express = require('express');
const { randomUUID } = require('crypto');
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

const selectSeries = db.prepare(`
  SELECT b.*, r.name AS room_name, u.name AS user_name
  FROM bookings b
  JOIN rooms r ON r.id = b.room_id
  JOIN users u ON u.id = b.user_id
  WHERE b.series_id = ?
  ORDER BY b.start_time
`);

// касающиеся слоты (end == start) НЕ считаются пересечением
const findOverlap = db.prepare(`
  SELECT b.id, b.start_time, b.end_time, b.topic, u.name AS user_name
  FROM bookings b
  JOIN users u ON u.id = b.user_id
  WHERE b.room_id = ?
    AND b.start_time < ?
    AND b.end_time   > ?
`);

const insertBooking = db.prepare(`
  INSERT INTO bookings (room_id, user_id, start_time, end_time, topic, series_id)
  VALUES (@room_id, @user_id, @start_time, @end_time, @topic, @series_id)
`);

const deleteBooking = db.prepare('DELETE FROM bookings WHERE id = ?');
const deleteSeries  = db.prepare('DELETE FROM bookings WHERE series_id = ?');
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

// повторяющиеся брони
function expandRecurrence(startISO, endISO, recurrence) {
  if (!recurrence || !recurrence.type || recurrence.type === 'none') {
    return [{ start: startISO, end: endISO }];
  }

  const { type, count } = recurrence;

  if (type !== 'daily' && type !== 'weekly') {
    const err = new Error("recurrence.type должен быть 'daily' | 'weekly' | 'none'");
    err.status = 400;
    throw err;
  }

  if (!Number.isInteger(count) || count < 1 || count > 60) {
    const err = new Error('recurrence.count должен быть целым от 1 до 60');
    err.status = 400;
    throw err;
  }

  const stepMs  = (type === 'daily' ? 1 : 7) * 24 * 60 * 60 * 1000;
  const startMs = new Date(startISO).getTime();
  const endMs   = new Date(endISO).getTime();

  const slots = [];
  for (let i = 0; i < count; i++) {
    slots.push({
      start: new Date(startMs + i * stepMs).toISOString(),
      end:   new Date(endMs   + i * stepMs).toISOString(),
    });
  }
  return slots;
}

/*
 * Создаёт одну или несколько связанных броней в одной транзакции
 * Если хотя бы один слот серии конфликтует — откатываются все
 */
function createBookingsTx({ roomId, userId, slots, topic }) {
  const conflicts = [];
  for (const slot of slots) {
    const busy = findOverlap.all(roomId, slot.end, slot.start);
    if (busy.length > 0) {
      conflicts.push({ slot, busy });
    }
  }

  if (conflicts.length > 0) {
    const err = new Error('Обнаружен конфликт бронирований');
    err.status = 409;
    err.conflicts = conflicts;
    throw err;
  }

  const seriesId = slots.length > 1 ? randomUUID() : null;

  const created = [];
  for (const slot of slots) {
    const info = insertBooking.run({
      room_id:    roomId,
      user_id:    userId,
      start_time: slot.start,
      end_time:   slot.end,
      topic,
      series_id:  seriesId,
    });
    created.push(selectBookingFull.get(info.lastInsertRowid));
  }

  return { seriesId, bookings: created };
}

const createBookingsImmediate = db.transaction(createBookingsTx).immediate;

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

// POST /api/bookings : создать бронь (или серию)
router.post('/', (req, res) => {
  const { roomId, userId, startTime, endTime, topic, recurrence } = req.body || {};

  if (!roomId || !userId || !startTime || !endTime || !topic) {
    return res.status(400).json({
      error: 'Обязательные поля: roomId, userId, startTime, endTime, topic',
    });
  }

  const room = getRoom.get(Number(roomId));
  if (!room) return res.status(404).json({ error: 'Комната не найдена' });

  const user = getUser.get(Number(userId));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

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

  // Раскрутка серии (или один слот, если recurrence нет)
  let slots;
  try {
    slots = expandRecurrence(startISO, endISO, recurrence);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }

  try {
    const result = createBookingsImmediate({
      roomId: Number(roomId),
      userId: Number(userId),
      slots,
      topic:  String(topic),
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.status === 409) {
      return res.status(409).json({ error: e.message, conflicts: e.conflicts });
    }
    console.error('[bookings] create error:', e);
    res.status(500).json({ error: 'Ошибка 500' });
  }
});

// DELETE /api/bookings/series/:seriesId : отменить всю серию
router.delete('/series/:seriesId', (req, res) => {
  const { seriesId } = req.params;
  const rows = selectSeries.all(seriesId);
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Серия не найдена' });
  }
  deleteSeries.run(seriesId);
  res.json({ ok: true, cancelledCount: rows.length, cancelled: rows });
});

// DELETE /api/bookings/:id : отменить одну бронь
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const booking = selectBookingFull.get(id);
  if (!booking) return res.status(404).json({ error: 'Бронь не найдена' });

  deleteBooking.run(id);
  res.json({ ok: true, cancelled: booking });
});

module.exports = router;