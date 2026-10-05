const http = require('http');
const path = require('path');
const express = require('express');
const ws = require('./ws');

require('./db');   // инициализирует схему и сиды

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/rooms',    require('./routes/room'));
app.use('/api/users',    require('./routes/user'));
app.use('/api/bookings', require('./routes/booking'));

// Единый обработчик ошибок
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

// создаём http-сервер вручную и передаём его в WS
const server = http.createServer(app);
ws.init(server);

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`HTTP:      http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});