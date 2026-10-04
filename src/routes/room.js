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

module.exports = router;