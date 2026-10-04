const express = require('express');
const db = require('../db');

const router = express.Router();

const listStmt = db.prepare('SELECT * FROM rooms ORDER BY floor, name');
const getStmt  = db.prepare('SELECT * FROM rooms WHERE id = ?');

// Хелпер: превратить equipment из JSON-строки в массив
const serialize = (room) => room && {
  ...room,
  equipment: JSON.parse(room.equipment),
};

// GET /api/rooms : список всех комнат
router.get('/', (_req, res) => {
  const rooms = listStmt.all().map(serialize);
  res.json(rooms);
});

// GET /api/rooms/:id : одна комната по id
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const room = getStmt.get(id);

  if (!room) {
    return res.status(404).json({ error: 'Комната не найдена' });
  }

  res.json(serialize(room));
});

// POST /api/rooms : создать комнату
const insertStmt = db.prepare(
  'INSERT INTO rooms (name, capacity, floor, equipment) VALUES (?, ?, ?, ?)'
);

router.post('/', (req, res) => {
  const { name, capacity, floor, equipment } = req.body || {};

  const errors = [];

  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Название комнаты должно быть непустым string');
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    errors.push('Вместительность integer > 0');
  }

  if (!Number.isInteger(floor)) {
    errors.push('Этаж должен быть integer');
  }

  if (equipment !== undefined) {
    if (!Array.isArray(equipment) || !equipment.every((x) => typeof x === 'string')) {
      errors.push('Оборудование должно содержать строковые значения');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Найдены ошибки в данных', details: errors });
  }

  const info = insertStmt.run(
    name.trim(),
    capacity,
    floor,
    JSON.stringify(equipment || [])
  );

  const created = getStmt.get(info.lastInsertRowid);
  res.status(201).json(serialize(created));
});

module.exports = router;