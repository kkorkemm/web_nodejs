const $ = (sel) => document.querySelector(sel);

let socket = null;

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  const url = `${proto}${location.host}/ws`;

  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log('[ws] подключен');
    updateWsStatus('connected');
  };

  socket.onclose = () => {
    console.warn('[ws] неподключен, переподключение...');
    updateWsStatus('disconnected');
    setTimeout(connectWS, 2000);   // автопереподключение
  };

  socket.onerror = (e) => console.error('[ws] error', e);

  socket.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    console.log('[ws] сообщение: ', msg);

    switch (msg.type) {
        case 'hello':
            break;

        case 'booking:created': {
            const b = msg.payload.bookings[0];
            const count = msg.payload.bookings.length;

            if (count === 1) {
            showToast({
                variant: 'created',
                title: 'Новая бронь',
                lines: [
                `${escapeHtml(b.room_name)} · ${fmt(b.start_time)}–${fmt(b.end_time)}`,
                `<span class="who">${escapeHtml(b.user_name)}</span>: ${escapeHtml(b.topic)}`,
                ],
            });
            } else {
            showToast({
                variant: 'created',
                title: `Создана серия из ${count} броней`,
                lines: [
                `${escapeHtml(b.room_name)} · начиная с ${fmt(b.start_time)}`,
                `<span class="who">${escapeHtml(b.user_name)}</span>: ${escapeHtml(b.topic)}`,
                ],
            });
            }
            loadBookings();
            break;
        }

        case 'booking:cancelled': {
            const { id, seriesId } = msg.payload;
            showToast({
            variant: 'cancelled',
            title: 'Бронь отменена',
            lines: [`Бронь #${id}${seriesId ? ' (часть серии)' : ''}`],
            });
            loadBookings();
            break;
        }

        default:
            console.warn('[ws]:', msg.type);
        }
  };
}

function updateWsStatus(status) {
  const el = document.getElementById('ws-status');
  if (!el) return;
  el.textContent = status === 'connected' ? 'онлайн' : 'оффлайн';
  el.className = status === 'connected' ? 'ws-online' : 'ws-offline';
}

/** Показать всплывающее уведомление */
function showToast({ variant, title, lines, onClick }) {
  const container = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${variant}`;

  el.innerHTML = `
    <div class="title">${escapeHtml(title)}</div>
    ${lines.map((l) => `<div class="row">${l}</div>`).join('')}
  `;

  el.onclick = () => {
    if (onClick) onClick();
    removeToast(el);
  };

  container.appendChild(el);

  // Ограничиваем стек 5 тостами
  while (container.children.length > 5) {
    container.removeChild(container.firstChild);
  }

  // Автозакрытие через 5 секунд
  setTimeout(() => removeToast(el), 5000);
}

function removeToast(el) {
  if (!el.parentNode) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 200);
}


async function api(path, options = {}) {
    const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || res.statusText);
        err.status = res.status;
        err.details = data.details;
        err.conflicts = data.conflicts;
        throw err;
    }
   return data;
}

function showMessage(text, type = 'ok') {
    const el = $('#message');
    el.textContent = text;
    el.className = `msg ${type}`;
    if (type === 'ok') {
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(() => el.classList.add('hidden'), 4000);
    }
}
function hideMessage() { $('#message').classList.add('hidden'); }

function fmt(iso) {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    });
}

function toLocalInputValue(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function loadRefs() {
    const [rooms, users] = await Promise.all([
    api('/api/rooms'),
    api('/api/users'),
    ]);

    $('[name=roomId]').innerHTML = rooms
    .map((r) => `<option value="${r.id}">${r.name} — этаж ${r.floor}, до ${r.capacity} чел.</option>`)
    .join('');

    $('[name=userId]').innerHTML = users
    .map((u) => `<option value="${u.id}">${u.name} (${u.email})</option>`)
    .join('');
}

async function loadBookings() {
    const container = $('#bookings-container');

    let items;
    try {
    items = await api('/api/bookings');
    } catch (e) {
    container.innerHTML = `<div class="msg error">Не удалось загрузить брони: ${e.message}</div>`;
    return;
    }

    if (items.length === 0) {
    container.innerHTML = '<div class="empty">Пока нет ни одной брони</div>';
    return;
    }

    const rows = items.map((b) => `
    <tr>
        <td>${b.id}</td>
        <td>${b.room_name}</td>
        <td>${b.user_name}</td>
        <td>${fmt(b.start_time)}</td>
        <td>${fmt(b.end_time)}</td>
        <td>${escapeHtml(b.topic)}</td>
        <td><button class="btn-cancel" data-id="${b.id}">Отменить</button></td>
    </tr>
    `).join('');

    container.innerHTML = `
    <table>
        <thead>
        <tr>
            <th>ID</th><th>Комната</th><th>Кто</th>
            <th>Начало</th><th>Конец</th><th>Тема</th>
            <th></th>
        </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>
    `;

    container.querySelectorAll('.btn-cancel').forEach((btn) => {
        btn.onclick = () => cancelBooking(Number(btn.dataset.id));
    });
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function presetTimes() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const start = new Date(now.getTime() + 60 * 60 * 1000); // +1 час
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +2 часа

    $('[name=startTime]').value = toLocalInputValue(start);
    $('[name=endTime]').value = toLocalInputValue(end);
}

/** Создание брони по данным формы */
async function createBooking(ev) {
    ev.preventDefault();
    hideMessage();

    const fd = new FormData(ev.target);
    const startLocal = fd.get('startTime');   // "YYYY-MM-DDTHH:MM" — локальное время браузера
    const endLocal   = fd.get('endTime');

    const recType = fd.get('recurrenceType');

    const body = {
    roomId: Number(fd.get('roomId')),
    userId: Number(fd.get('userId')),
    startTime: new Date(startLocal).toISOString(),
    endTime:   new Date(endLocal).toISOString(),
    topic: fd.get('topic').trim(),
    };

    if (recType !== 'none') {
    body.recurrence = {
        type: recType,
        count: Number(fd.get('recurrenceCount')),
    };
    }

    const btn = $('#submit-btn');
    btn.disabled = true;

    try {
    const result = await api('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    const count = result.bookings.length;
    const first = result.bookings[0];

    if (count === 1) {
        showMessage(`Бронь #${first.id} создана: ${first.room_name}, ${fmt(first.start_time)}`, 'ok');
    } else {
        showMessage(
        `Серия из ${count} броней создана: ${first.room_name}, начиная с ${fmt(first.start_time)}`,
        'ok'
        );
    }

    ev.target.reset();
    presetTimes();
    await loadBookings();
    } catch (e) {   
        if (e.status === 409 && e.conflicts) {
            const lines = e.conflicts.map((c) =>
            `• ${fmt(c.slot.start)} – ${fmt(c.slot.end)} конфликтует с бронью "${c.busy[0].topic}" (${c.busy[0].user_name})`
            ).join('\n');
            showMessage(`${e.message}:\n${lines}`, 'error');
        } else if (e.details) {
            showMessage(`${e.message}\n${e.details.map((d) => '• ' + d).join('\n')}`, 'error');
        } else {
            showMessage(e.message, 'error');
        }
    }
    finally { btn.disabled = false; }
}

/** Отмена брони */
async function cancelBooking(id) {
    if (!confirm(`Отменить бронь #${id}?`)) return;
    hideMessage();
    try {
    await api('/api/bookings/' + id, { method: 'DELETE' });
    showMessage(`Бронь #${id} отменена`, 'ok');
    await loadBookings();
    } catch (e) {
    showMessage(`Не удалось отменить: ${e.message}`, 'error');
    }
}

(async function main() {
    presetTimes();
    connectWS(); 
    try {
        await loadRefs();
    } catch (e) {
        showMessage('Не удалось загрузить справочники: ' + e.message, 'error');
    return;
    }
    await loadBookings();
    $('#booking-form').addEventListener('submit', createBooking);
})();