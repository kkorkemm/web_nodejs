const path = require('path');
const express = require('express');

require('./db');   // инициализирует схему и сиды

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

// Подключаем маршруты комнат
app.use('/api/rooms', require('./routes/room'));

// Единый обработчик ошибок (должен идти последним)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`HTTP: http://localhost:${PORT}`);
});