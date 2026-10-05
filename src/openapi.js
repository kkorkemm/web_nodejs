module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'API для системы бронирования',
    version: '1.0.0',
    description:
      'Система бронирования переговорных комнат.\n\n' +
      'Поддерживает: CRUD комнат и пользователей, проверку пересечений ' +
      'броней, повторяющиеся брони (ежедневные/еженедельные), WebSocket-уведомления. \n\n' +
      'Лабораторная работа №3, вариант 4. Группа 932609, Жардемова Коркем.'
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Локальный запуск' },
  ],
  tags: [
    { name: 'Rooms',    description: 'Переговорные комнаты' },
    { name: 'Users',    description: 'Пользователи' },
    { name: 'Bookings', description: 'Брони (одиночные и серии)' },
  ],
  components: {
    schemas: {
      Room: {
        type: 'object',
        properties: {
          id:        { type: 'integer', example: 1 },
          name:      { type: 'string',  example: 'Конференц-зал' },
          capacity:  { type: 'integer', example: 12 },
          floor:     { type: 'integer', example: 3 },
          equipment: { type: 'array', items: { type: 'string' }, example: ['проектор', 'доска'] },
        },
      },
      User: {
        type: 'object',
        properties: {
          id:    { type: 'integer', example: 1 },
          name:  { type: 'string',  example: 'Коркем Жардемова' },
          email: { type: 'string',  example: 'korkem@mail.ru' },
        },
      },
      Booking: {
        type: 'object',
        properties: {
          id:          { type: 'integer', example: 1 },
          room_id:     { type: 'integer', example: 1 },
          user_id:     { type: 'integer', example: 1 },
          start_time:  { type: 'string', format: 'date-time' },
          end_time:    { type: 'string', format: 'date-time' },
          topic:       { type: 'string', example: 'Дейлик' },
          series_id:   { type: 'string', nullable: true, example: null },
          room_name:   { type: 'string', example: 'Конференц-зал' },
          user_name:   { type: 'string', example: 'Еркем Жардемова' },
        },
      },
      Recurrence: {
        type: 'object',
        properties: {
          type:  { type: 'string', enum: ['none', 'daily', 'weekly'], example: 'weekly' },
          count: { type: 'integer', minimum: 1, maximum: 60, example: 4 },
        },
      },
      BookingCreate: {
        type: 'object',
        required: ['roomId', 'userId', 'startTime', 'endTime', 'topic'],
        properties: {
          roomId:     { type: 'integer', example: 1 },
          userId:     { type: 'integer', example: 1 },
          startTime:  { type: 'string', format: 'date-time', example: '2026-11-10T10:00:00Z' },
          endTime:    { type: 'string', format: 'date-time', example: '2026-11-10T11:00:00Z' },
          topic:      { type: 'string', example: 'Еженедельная встреча' },
          recurrence: { $ref: '#/components/schemas/Recurrence' },
        },
      },
      BookingCreateResponse: {
        type: 'object',
        properties: {
          seriesId: { type: 'string', nullable: true },
          bookings: { type: 'array', items: { $ref: '#/components/schemas/Booking' } },
        },
      },
      ConflictError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Обнаружен конфликт бронирований' },
          conflicts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slot: { type: 'object' },
                busy: { type: 'array', items: { $ref: '#/components/schemas/Booking' } },
              },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
  paths: {
    '/api/rooms': {
      get: {
        tags: ['Rooms'], summary: 'Список всех комнат',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Room' } } } } },
        },
      },
      post: {
        tags: ['Rooms'], summary: 'Создать комнату',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RoomCreate' } } } },
        responses: {
          201: { description: 'Создано', content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } } },
          400: { description: 'Ошибка валидации', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/rooms/{id}': {
      get: {
        tags: ['Rooms'], summary: 'Получить комнату по id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } } },
          404: { description: 'Не найдено', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/users': {
      get: {
        tags: ['Users'], summary: 'Список пользователей',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } } },
      },
      post: {
        tags: ['Users'], summary: 'Создать пользователя',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserCreate' } } } },
        responses: {
          201: { description: 'Создано', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          409: { description: 'Email уже существует', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'], summary: 'Получить пользователя по id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          404: { description: 'Не найдено', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/bookings': {
      get: {
        tags: ['Bookings'], summary: 'Список всех броней',
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Booking' } } } } },
        },
      },
      post: {
        tags: ['Bookings'], summary: 'Создать бронь (возможно, серию)',
        description: 'Транзакционно проверяет пересечения. Если конфликтует хотя бы один слот серии — вся серия отклоняется.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingCreate' } } } },
        responses: {
          201: { description: 'Создано', content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingCreateResponse' } } } },
          400: { description: 'Ошибка валидации', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Комната или пользователь не найдены', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Конфликт бронирований', content: { 'application/json': { schema: { $ref: '#/components/schemas/ConflictError' } } } },
        },
      },
    },
    '/api/bookings/{id}': {
      get: {
        tags: ['Bookings'], summary: 'Получить бронь по id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
          404: { description: 'Не найдено', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      delete: {
        tags: ['Bookings'], summary: 'Отменить одну бронь',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Отменено' },
          404: { description: 'Не найдено', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
  },
};