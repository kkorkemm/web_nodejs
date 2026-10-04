const express = require('express');
const db = require('../db');

const router = express.Router();

const listStmt   = db.prepare('SELECT * FROM users ORDER BY name');
const getStmt    = db.prepare('SELECT * FROM users WHERE id = ?');
const insertStmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');

//  GET /api/users
router.get('/', (_req, res) => {
  res.json(listStmt.all());
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const user = getStmt.get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/users
router.post('/', (req, res) => {
  const { name, email } = req.body || {};

  const errors = [];
  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Имя должно быть непустым string');
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email должен быть корректным адресом');
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Найдены ошибки в данных', details: errors });
  }

  try {
    const info = insertStmt.run(name.trim(), email.trim().toLowerCase());
    res.status(201).json(getStmt.get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }
    throw e;
  }
});

module.exports = router;