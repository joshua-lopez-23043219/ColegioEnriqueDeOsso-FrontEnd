/**
 * scriptAnalisisIA.js — Panel de Análisis IA (solo Director)
 *
 * Consume POST /apiAnalitica/Analitica/chat/ y muestra el diagnóstico en español.
 * El backend degrada a un resumen determinístico si no hay LLM configurado, así
 * que esta pantalla funciona incluso sin el servidor de IA en producción.
 *
 * Usa textContent (no innerHTML) para todo el contenido dinámico -> sin riesgo XSS.
 */
document.addEventListener('DOMContentLoaded', () => {
  // global.js ya redirige a quien no sea DIRECTOR (pageAccess), pero validamos
  // igual para no montar la interfaz en un rol no autorizado.
  if (localStorage.getItem('user_role') !== 'DIRECTOR') return;

  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const cutDateEl = document.getElementById('chat-cutdate');

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(who, text, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg chat-msg--' + who;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble' + (opts.pending ? ' chat-bubble--pending' : '');
    bubble.textContent = text;
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function addNote(text) {
    const note = document.createElement('div');
    note.className = 'chat-note';
    note.textContent = text;
    messagesEl.appendChild(note);
    scrollBottom();
  }

  function loadHistory() {
    apiFetch('/apiAnalitica/Analitica/history/')
      .then(res => (res.ok ? res.json() : []))
      .then(list => {
        (list || []).forEach(m => addMessage(m.role === 'user' ? 'user' : 'ai', m.message));
      })
      .catch(() => { /* historial vacío o backend no disponible: sin bloqueo */ });
  }

  function send() {
    const question = inputEl.value.trim();
    if (!question) {
      showToast('Escriba una pregunta', 'warning');
      return;
    }

    addMessage('user', question);
    inputEl.value = '';
    sendBtn.disabled = true;
    const pending = addMessage('ai', 'Analizando los datos…', { pending: true });

    const body = { question };
    if (cutDateEl && cutDateEl.value) body.cut_date = cutDateEl.value;

    apiFetch('/apiAnalitica/Analitica/chat/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => {
            throw new Error(err.error || 'Error en el análisis');
          });
        }
        return res.json();
      })
      .then(data => {
        pending.remove();
        addMessage('ai', data.answer || 'Sin respuesta.');
        if (data.source === 'template') {
          addNote('Resumen automático (IA generativa aún no configurada).');
        }
      })
      .catch(err => {
        pending.remove();
        addMessage('ai', 'No se pudo completar el análisis: ' + err.message);
      })
      .finally(() => {
        sendBtn.disabled = false;
      });
  }

  sendBtn.addEventListener('click', send);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  document.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      inputEl.value = chip.textContent;
      inputEl.focus();
    });
  });

  loadHistory();
});
