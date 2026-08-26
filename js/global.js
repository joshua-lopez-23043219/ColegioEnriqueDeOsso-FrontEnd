/**
 * =============================================
 *  PA-CEO — Global JavaScript
 *  Funciones compartidas por todas las páginas
 * =============================================
 */

// El dominio propio del colegio. Es el UNICO lugar del frontend donde se
// decide a donde apunta la API: cambiarlo aqui mueve las 30 paginas.
// Ojo: la CSP de cada .html tambien nombra este host y hay que moverla
// con el, o el navegador bloquea las llamadas sin decir por que.
const API_BASE_URL = 'https://backendcolegioenriquedeosso.sistemaacademico.com';

function getApiUrl(endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const slash = endpoint.startsWith('/') ? '' : '/';
  return `${API_BASE_URL}${slash}${endpoint}`;
}

/**
 * Renueva el access_token usando el refresh_token guardado.
 *
 * Antes (CN-019), el access_token duraba 7 días y nunca se renovaba, así que
 * un token robado (p.ej. vía el XSS ya corregido en scriptGrupo.js /
 * gestionUsuarios.html) seguía siendo válido casi una semana. Ahora el
 * access_token dura 1 hora; esta función lo renueva en silencio para que la
 * sesión del usuario no se corte, y guarda el refresh_token nuevo que
 * devuelve el backend (SIMPLE_JWT tiene ROTATE_REFRESH_TOKENS activado: cada
 * refresh invalida el token anterior y emite uno nuevo).
 *
 * Devuelve el access_token nuevo, o null si no se pudo renovar (refresh
 * vencido/revocado, o no hay sesión) -- en ese caso quien llama debe cerrar
 * la sesión.
 */
let _refreshEnCurso = null;
async function _renovarAccessToken() {
  if (_refreshEnCurso) return _refreshEnCurso;

  _refreshEnCurso = (async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return null;
    try {
      const res = await fetch(getApiUrl('/api/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.access) return null;
      localStorage.setItem('access_token', data.access);
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh);
      }
      return data.access;
    } catch (e) {
      return null;
    }
  })();

  const resultado = await _refreshEnCurso;
  _refreshEnCurso = null;
  return resultado;
}

async function apiFetch(endpoint, options = {}, _retried = false) {
  const url = getApiUrl(endpoint);
  options.headers = options.headers || {};

  if (options.body && !(options.body instanceof FormData) && !options.headers['Content-Type']) {
    options.headers['Content-Type'] = 'application/json';
  }

  const token = localStorage.getItem('access_token');
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, options);

  if (response.status === 401 && !_retried) {
    const nuevoToken = await _renovarAccessToken();
    if (nuevoToken) {
      return apiFetch(endpoint, options, true);
    }
  }

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = 'vistaPrinc.html';
    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
  }

  return response;
}

function escapeHtml(string) {
  if (string === null || string === undefined) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ========== Navegación: Volver Atrás ========== */
function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = 'index.html';
  }
}

/* ========== Dropdown de Perfil & Protección de Páginas ========== */
document.addEventListener('DOMContentLoaded', function () {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const role = (localStorage.getItem('user_role') || '').trim();
  const username = (localStorage.getItem('user_username') || '').trim().toLowerCase();
  const isAdmin = (role === 'ADMINISTRADOR' || role === 'ADMIN' || username === 'admin');

  // 0. Mostrar cualquier alerta pendiente guardada en localStorage
  const pendingToast = localStorage.getItem('pending_toast');
  if (pendingToast) {
    try {
      const toastData = JSON.parse(pendingToast);
      showToast(toastData.message, toastData.type);
    } catch (e) {}
    localStorage.removeItem('pending_toast');
  }
  
  // 1. Validar que exista una sesión activa
  if (!role && !username && currentPage !== 'vistaPrinc.html' && currentPage !== 'ayuda.html') {
    window.location.href = 'vistaPrinc.html';
    return;
  }
  
  // 2. Control de acceso por roles
  const pageAccess = {
    'registros.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION'],
    'registroEstudiante.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION'],
    'registroTutor.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION'],
    'registroMaestro.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION'],
    'registroGrupo.html': ['ADMINISTRADOR', 'DIRECTOR'],
    'registroAsignatura.html': ['ADMINISTRADOR', 'DIRECTOR'],
    'gAcademica.html': ['ADMINISTRADOR', 'DIRECTOR', 'DOCENTE', 'ADMINISTRACION'],
    'registroAsistencia.html': ['ADMINISTRADOR', 'DIRECTOR', 'DOCENTE'],
    'registroNotas.html': ['ADMINISTRADOR', 'DIRECTOR', 'DOCENTE', 'TUTOR', 'ESTUDIANTE'],
    'registroHorario.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION'],
    'registroMatricula.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION', 'TUTOR'],
    // El reingreso lo tramita el personal en ventanilla. El tutor no entra
    // aquí: su rematrícula en línea sigue por registroMatricula.html, que ya
    // valida la ventana de reingreso y que el estudiante sea el suyo.
    'registroReingreso.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION'],
    'confirmarMatricula.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION'],
    'dashboard.html': ['ADMINISTRADOR', 'DIRECTOR'],
    'analisisIA.html': ['ADMINISTRADOR', 'DIRECTOR'],
    'portalEstudiante.html': ['ADMINISTRADOR', 'ESTUDIANTE'],
    'actividades.html': ['ADMINISTRADOR', 'DIRECTOR', 'DOCENTE'],
    'listadoEstudiantes.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION'],
    'listadoDocentes.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION'],
    'gestionUsuarios.html': ['ADMINISTRADOR', 'DIRECTOR', 'ADMINISTRACION'],
  };
  
  if (isAdmin) {
    // El Administrador del Sistema tiene acceso total a todos los módulos y vistas
  } else if (role && pageAccess[currentPage] && !pageAccess[currentPage].includes(role)) {
    localStorage.setItem('pending_toast', JSON.stringify({
      message: 'Acceso no autorizado a esta sección',
      type: 'error'
    }));
    window.location.href = 'index.html';
    return;
  }

  // 3. Dropdown de perfil
  const profile = document.querySelector('.nav__profile');
  if (!profile) return;

  const imgProfile = profile.querySelector('.nav__profile-img');
  const dropdownProfile = profile.querySelector('.nav__profile-link');

  if (!imgProfile || !dropdownProfile) return;

  imgProfile.addEventListener('click', function (event) {
    event.stopPropagation();
    dropdownProfile.classList.toggle('show');
  });

  document.addEventListener('click', function () {
    dropdownProfile.classList.remove('show');
  });

  dropdownProfile.addEventListener('click', function (event) {
    event.stopPropagation();
  });

  /* ========== Cerrar Sesión ========== */
  const closeLinks = dropdownProfile.querySelectorAll('a');
  closeLinks.forEach(function (link) {
    if (link.textContent.trim().includes('Cerrar Sesión')) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.clear(); // Limpiar variables de sesión
        window.location.href = 'vistaPrinc.html';
      });
    }
  });
});

/* ========== Sistema de Alertas Premium (Toast) ========== */
// duracionMs: gestionUsuarios.html llama showToast(msg, tipo, 8000) al
// mostrar una contraseña temporal -- antes el tercer argumento se ignoraba
// y el toast desaparecia a los 4s fijos, muy poco para copiar una clave.
function showToast(message, type = 'info', duracionMs = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  else if (type === 'error') icon = '❌';
  else if (type === 'warning') icon = '⚠️';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.textContent = icon;

  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-message';
  msgSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
  container.appendChild(toast);

  // Animación de entrada
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Remoción automática
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, duracionMs);
}

/**
 * Nombre con el que debe guardarse un archivo descargado.
 *
 * El servidor envía dos formas en Content-Disposition: `filename*` codificada
 * en UTF-8 (la que conserva los acentos) y `filename` en ASCII como respaldo.
 * Se prefiere la primera. Requiere que el backend exponga la cabecera vía
 * CORS; si no llega, se usa el nombre por defecto que indique quien llama.
 */
function _nombreDescarga(respuesta, porDefecto = 'reporte.xlsx') {
  const cd = respuesta.headers.get('Content-Disposition') || '';

  const utf8 = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch (e) {
      // Codificación inválida: se sigue con la forma ASCII.
    }
  }

  const ascii = cd.match(/filename="?([^";]+)"?/i);
  return ascii ? ascii[1].trim() : porDefecto;
}

/* ========== Cierre automático de modales al hacer clic afuera (Backdrop) ========== */
document.addEventListener('click', function(e) {
  if (e.target && e.target.classList.contains('modal__container')) {
    e.target.style.display = 'none';
  }
});
