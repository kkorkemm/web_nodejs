const $ = (sel) => document.querySelector(sel);

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

    const body = {
    roomId: Number(fd.get('roomId')),
    userId: Number(fd.get('userId')),
    // new Date("YYYY-MM-DDTHH:MM") парсит как локальное время браузера,
    // а toISOString() отдаёт UTC с 'Z' — так на сервер уйдёт однозначное время.
    startTime: new Date(startLocal).toISOString(),
    endTime:   new Date(endLocal).toISOString(),
    topic: fd.get('topic').trim(),
    };

    const btn = $('#submit-btn');
    btn.disabled = true;

    try {
    const created = await api('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    showMessage(`Бронь #${created.id} создана: ${created.room_name}, ${fmt(created.start_time)}`, 'ok');
    ev.target.reset();
    presetTimes();
    await loadBookings();
    } catch (e) {
    if (e.status === 409 && e.conflicts) {
        const lines = e.conflicts.map((c) =>
        `• ${fmt(c.start_time)} – ${fmt(c.end_time)} (${c.topic}, ${c.user_name})`
        ).join('\n');
        showMessage(`${e.message}:\n${lines}`, 'error');
    } else if (e.details) {
        showMessage(`${e.message}\n${e.details.map((d) => '• ' + d).join('\n')}`, 'error');
    } else {
        showMessage(e.message, 'error');
    }
    } finally {
    btn.disabled = false;
    }
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
    try {
    await loadRefs();
    } catch (e) {
    showMessage('Не удалось загрузить справочники: ' + e.message, 'error');
    return;
    }
    await loadBookings();
    $('#booking-form').addEventListener('submit', createBooking);
})();