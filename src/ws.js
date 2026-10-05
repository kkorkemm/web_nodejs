const { WebSocketServer } = require('ws');

let wss = null;

function init(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket) => {
    console.log('[ws] подключен, кол-во клиентов:', wss.clients.size);

    socket.send(JSON.stringify({ type: 'hello', payload: { message: 'connected' } }));

    socket.on('close', () => {
      console.log('[ws] неподключен, кол-во клиентов:', wss.clients.size);
    });

    socket.on('error', (err) => console.error('[ws] ошибка:', err.message));
  });

  console.log('[ws] Прослушивается... /ws');
  return wss;
}

// Рассылка события всем подключённым клиентам
function broadcast(event) {
  if (!wss) return;
  const msg = JSON.stringify(event);
  for (const client of wss.clients) {
    // 1 = OPEN. Отправляем только тем, у кого соединение готово.
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

module.exports = { init, broadcast };