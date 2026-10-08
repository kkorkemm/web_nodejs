# Система бронирований переговорных комнат

Система бронирования переговорных комнат с проверкой пересечений по времени,
поддержкой повторяющихся броней и WebSocket-уведомлениями в реальном времени.

Лаб 3 по Node.js, вариант 4. Жардемова Коркем, группа 932609.

---

## Стек

- **Node.js 22** + **Express** — HTTP-сервер и маршруты
- **better-sqlite3** — встраиваемая БД, транзакции, prepared statements
- **ws** — WebSocket-сервер для уведомлений в реальном времени
- **swagger-ui-express** — интерактивная документация на `/docs`
- **Docker + docker-compose** — запуск одной командой

---

## Возможности

- Создание переговорных комнат и пользователей.
- Создание броней с  проверкой пересечений по времени
- Повторяющиеся брони (ежедневные / еженедельные) в отдельные слоты
  и общим `series_id`.
- Отмена одиночной брони.
- WebSocket-уведомления всем подключённым клиентам при создании и отмене
  брони. Фронт обновляется мгновенно, во всех открытых вкладках.
- Swagger UI на `/docs` со всеми эндпоинтами и схемами.
- Данные в SQLite сохраняются между перезапусками контейнера.

---

## Запуск через Docker

Требуется установленный Docker Desktop.

```bash
git clone https://github.com/kkorkemm/web_nodejs.git
cd web_nodejs
cp .env.example .env
docker compose up --build
```

После старта доступны:

- **Приложение:** http://localhost:3000
- **Swagger UI:** http://localhost:3000/docs

Остановить:

```bash
docker compose down
```

Остановить и удалить БД (named volume):

```bash
docker compose down -v
```

---

## Локальный запуск (без Docker)

Требуется Node.js 20+.

```bash
npm install
cp .env.example .env
npm start
```

---

## Переменные окружения

Файл `.env` создаётся копированием из `.env.example`.

| Переменная | По умолчанию    | Назначение                       |
|------------|-----------------|----------------------------------|
| `PORT`     | `3000`          | Порт HTTP и WebSocket            |
| `DB_PATH`  | `./data.db`     | Путь к файлу SQLite              |
| `NODE_ENV` | `development`   | Режим (`development`/`production`) |


---

## Эндпоинты

Полная спецификация OpenAPI доступна на `/docs` (Swagger UI) (http://localhost:3000/docs).

---

## Структура проекта

- `Dockerfile`
- `docker-compose.yml`
- `dockerignore`
- `env.example`
- `.gitignore`
- `package.json`
- `README.md`
- `public/`  - фронт (форма + таблица броней + WS-уведомления)
    - `index.html`
    - `style.css`
    - `script.js`
- `src/`
    - `server.js`  - точка входа: HTTP + WS + роуты + Swagger
    - `db.js` - схема SQLite, сиды, prepared-хелперы
    - `ws.js` - WebSocket-сервер и broadcast
    - `openapi.js` - OpenAPI 3.0 спецификация
    - `routes/` - маршруты
        - `room.js`
        - `user.js`
        - `booking.js` - ядро: транзакции, пересечения, серии
