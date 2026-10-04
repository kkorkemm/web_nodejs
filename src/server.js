const path = require('path');
const express = require('express');

require('./db');   // инициализирует схему и сиды

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

// Подключаем маршруты комнат
app.use('/api/rooms', require('./routes/room'));
app.use('/api/users', require('./routes/user'));
app.use('/api/bookings', require('./routes/booking'));

// Единый обработчик ошибок
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Ошибка 500' });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`HTTP: http://localhost:${PORT}`);
});