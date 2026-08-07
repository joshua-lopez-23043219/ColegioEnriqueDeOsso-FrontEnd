// js/confirmarMatricula.js — Portal Académico CEO
document.addEventListener('DOMContentLoaded', () => {
  const role = localStorage.getItem('user_role');
  
  // 1. Validar accesos
  if (role !== 'DIRECTOR' && role !== 'ADMINISTRACION' && role !== 'ADMINISTRADOR') {
    showToast('Acceso Denegado: Su rol no cuenta con permisos para ver esta sección', 'error');
    setTimeout(() => {
      window.location.href = './index.html';
    }, 2000);
    return;
  }

  // Si no es director ni administrador, ocultar pestaña 2 de configuración
  if (role !== 'DIRECTOR' && role !== 'ADMINISTRADOR') {
    const configTab = document.getElementById('tab_btn_2');
    if (configTab) configTab.style.display = 'none';
  }

  // Cargar datos iniciales
  loadPendingRegistrations();
  if (role === 'DIRECTOR' || role === 'ADMINISTRADOR') {
    cargarVentanas();
  }

  // Botones de guardado por ventana (Reingreso / Matrícula)
  document.querySelectorAll('[data-ventana]').forEach(btn => {
    btn.addEventListener('click', () => guardarVentana(btn.dataset.ventana));
  });

  // Descarga del reporte de continuidad
  const btnCont = document.getElementById('btn-export-continuidad');
  if (btnCont) btnCont.addEventListener('click', exportarContinuidad);
});

/* =========================================================================
   Ventanas de matrícula en línea (Reingreso y Matrícula)
   ========================================================================= */

// Prefijo de los ids del formulario de cada ventana.
const PREFIJO_VENTANA = { reingreso: 'rein', matricula: 'mat' };

function _campos(ventana) {
  const p = PREFIJO_VENTANA[ventana];
  return {
    enabled: document.getElementById(`${p}_enabled`),
    period: document.getElementById(`${p}_period`),
    start: document.getElementById(`${p}_start`),
    end: document.getElementById(`${p}_end`),
    estado: document.getElementById(`estado-${ventana}`),
  };
}

function _pintarEstado(ventana, datos) {
  const c = _campos(ventana);
  if (!c.enabled) return;

  c.enabled.value = datos.habilitada ? 'true' : 'false';
  c.period.value = datos.periodo || '';
  c.start.value = datos.fecha_inicio || '';
  c.end.value = datos.fecha_fin || '';

  if (c.estado) {
    c.estado.textContent = datos.abierta ? 'Abierta ahora' : (datos.motivo || 'Cerrada');
    c.estado.className = 'status-pill ' +
      (datos.abierta ? 'status-pill--success' : 'status-pill--neutral');
  }
}

function cargarVentanas() {
  apiFetch('/apiUserCreate/UsuarioCreate/GetEnrollmentWindow/')
    .then(res => {
      if (!res.ok) throw new Error('No se pudo cargar la configuración');
      return res.json();
    })
    .then(data => {
      const v = data.ventanas || {};
      if (v.reingreso) _pintarEstado('reingreso', v.reingreso);
      if (v.matricula) _pintarEstado('matricula', v.matricula);
    })
    .catch(err => showToast(err.message, 'error'));
}

function guardarVentana(ventana) {
  const c = _campos(ventana);
  if (!c.enabled) return;

  if (c.start.value && c.end.value && c.end.value < c.start.value) {
    showToast('La fecha de fin no puede ser anterior a la de inicio', 'warning');
    return;
  }

  apiFetch('/apiUserCreate/UsuarioCreate/ToggleEnrollmentWindow/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ventana: ventana,
      habilitada: c.enabled.value === 'true',
      periodo: c.period.value.trim(),
      fecha_inicio: c.start.value || '',
      fecha_fin: c.end.value || '',
    }),
  })
    .then(res => res.json().then(body => ({ ok: res.ok, body })))
    .then(({ ok, body }) => {
      if (!ok) throw new Error(body.error || 'No se pudo guardar la configuración');
      if (body.estado) _pintarEstado(ventana, body.estado);
      showToast(body.message || 'Configuración guardada', 'success');
    })
    .catch(err => showToast(err.message, 'error'));
}

/** Descarga el Excel de continuidad (quiénes confirmaron reingreso y quiénes no). */
function exportarContinuidad() {
  showToast('Generando reporte…', 'info');
  apiFetch('/apiAnalitica/Analitica/ExportarContinuidad/')
    .then(res => {
      if (!res.ok) throw new Error('No se pudo generar el reporte');
      return res.blob().then(blob => ({ blob, nombre: _nombreDescarga(res, 'Continuidad.xlsx') }));
    })
    .then(({ blob, nombre }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Reporte descargado', 'success');
    })
    .catch(err => showToast(err.message, 'error'));
}

// Cache global de registros cargados para modal detalles
let cachedPendingRegistrations = [];

// Cambiar de pestaña (tab navigation)
function showTab(tabNum) {
  // Desactivar todas las pestañas y contenidos
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.step-content').forEach(content => content.classList.remove('active'));

  // Activar seleccionada
  const activeBtn = document.getElementById(`tab_btn_${tabNum}`);
  if (activeBtn) activeBtn.classList.add('active');

  const activeContent = document.getElementById(`step_${tabNum}`);
  if (activeContent) activeContent.classList.add('active');
}

// Cargar listado de matrículas pendientes
/**
 * Ocupación del grupo: "28/30" más las pendientes que aún compiten por el cupo.
 * Es informativo — un grupo lleno no impide confirmar, solo avisa que sería
 * una excepción.
 */
function _badgeCupo(reg) {
  const total = reg.cupo_total || 0;
  if (!total) return '';

  const confirmados = reg.cupo_confirmados || 0;
  const pendientes = reg.cupo_pendientes || 0;
  const lleno = confirmados >= total;

  const color = lleno ? 'var(--danger)' : 'var(--gray-600)';
  const titulo = lleno
    ? `Grupo lleno (${confirmados}/${total} confirmados). Confirmar sería una excepción.`
    : `${confirmados} de ${total} cupos confirmados; ${pendientes} pendientes por revisar.`;

  return `<span title="${titulo}"
    style="display:block; margin-top:4px; font-size:0.74rem; font-weight:600; color:${color};">
    ${confirmados}/${total}${pendientes ? ` · ${pendientes} pend.` : ''}
  </span>`;
}

/** Fila de una matrícula pendiente. */
function _filaPendiente(reg) {
  const tr = document.createElement('tr');
  tr.className = 'form__table-fila';

  // Quien registró la matrícula no puede confirmarla: se muestra el botón
  // deshabilitado con la razón, en vez de dejar que falle al pulsarlo.
  const botonConfirmar = reg.puede_confirmar
    ? `<button type="button" class="form__button--green"
         style="padding: 6px 12px; font-size: 0.82rem; margin: 0; box-shadow: none;"
         onclick="confirmarMatricula(${reg.id})">Confirmar</button>`
    : `<button type="button" class="form__button--green" disabled
         style="padding: 6px 12px; font-size: 0.82rem; margin: 0; box-shadow: none; opacity: 0.5; cursor: not-allowed;"
         title="Usted registró esta matrícula; debe confirmarla otra persona.">Confirmar</button>`;

  tr.innerHTML = `
    <td class="form__table-campo" style="font-weight:600; color:var(--primary-dark);">${escapeHtml(reg.code_registration)}</td>
    <td class="form__table-campo" style="text-align: left; padding-left: 12px;">${escapeHtml(reg.student_name)}<br><small style="color:var(--gray-600);">${escapeHtml(reg.student_code)}</small></td>
    <td class="form__table-campo">${escapeHtml(reg.level_registration)}</td>
    <td class="form__table-campo">${escapeHtml(reg.mode_registration)}</td>
    <td class="form__table-campo">
      <span style="background:var(--primary-glow); color:var(--primary); padding: 4px 8px; border-radius:var(--radius-sm); font-size:0.85rem; font-weight:600;">${escapeHtml(reg.group_code)}</span>
      ${_badgeCupo(reg)}
    </td>
    <td class="form__table-campo">${escapeHtml(String(reg.anio_lectivo || ''))}</td>
    <td class="form__table-campo">
      <div style="display: flex; gap: 8px; justify-content: center;">
        <button type="button" class="form__button--purple" style="padding: 6px 12px; font-size: 0.82rem; margin: 0; box-shadow: none;" onclick="openDetailsModal(${reg.id})">
          👁️ Detalles
        </button>
        ${botonConfirmar}
      </div>
    </td>
  `;
  return tr;
}

/** Pinta un bloque (nuevos ingresos o reingresos) con su contador. */
function _pintarBloque(idTbody, idConteo, registros, vacio) {
  const tbody = document.getElementById(idTbody);
  const conteo = document.getElementById(idConteo);
  if (!tbody) return;

  tbody.innerHTML = '';
  if (conteo) conteo.textContent = registros.length;

  if (registros.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" class="pendientes-bloque__vacio">${vacio}</td>`;
    tbody.appendChild(tr);
    return;
  }
  registros.forEach(reg => tbody.appendChild(_filaPendiente(reg)));
}

function loadPendingRegistrations() {
  const noPendingMsg = document.getElementById('no-pending-message');
  if (!document.getElementById('tbody-nuevos')) return;

  apiFetch('/apiRegistration/Registration/GetPendingRegistrations/')
    .then(res => {
      if (!res.ok) throw new Error('Error al cargar matrículas pendientes');
      return res.json();
    })
    .then(data => {
      const nuevos = data.nuevos_ingresos || [];
      const reingresos = data.reingresos || [];

      // El modal de detalles busca por id sobre una sola lista.
      cachedPendingRegistrations = nuevos.concat(reingresos);

      const hayPendientes = cachedPendingRegistrations.length > 0;
      if (noPendingMsg) noPendingMsg.style.display = hayPendientes ? 'none' : 'block';
      ['bloque-nuevos', 'bloque-reingresos'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = hayPendientes ? 'block' : 'none';
      });
      if (!hayPendientes) return;

      _pintarBloque('tbody-nuevos', 'conteo-nuevos', nuevos,
        'Sin nuevos ingresos pendientes.');
      _pintarBloque('tbody-reingresos', 'conteo-reingresos', reingresos,
        'Sin reingresos pendientes.');
    })
    .catch(err => {
      console.error(err);
      showToast('No se pudieron cargar las matrículas pendientes', 'error');
    });
}

// Abrir modal con detalles completos
function openDetailsModal(registrationId) {
  const reg = cachedPendingRegistrations.find(r => r.id === registrationId);
  if (!reg) return;

  // Rellenar datos estudiante
  document.getElementById('det-student-name').textContent = reg.student_name;
  document.getElementById('det-student-code').textContent = reg.student_code;
  document.getElementById('det-level').textContent = reg.level_registration;
  document.getElementById('det-mode').textContent = reg.mode_registration;
  document.getElementById('det-group').textContent = reg.group_code || 'Ninguno';

  // Rellenar datos tutor
  document.getElementById('det-tutor-name').textContent = reg.tutor_name || 'No ingresado';
  document.getElementById('det-tutor-phone').textContent = reg.tutor_phone || 'No ingresado';
  document.getElementById('det-tutor-email').textContent = reg.tutor_email || 'No ingresado';
  document.getElementById('det-tutor-address').textContent = reg.tutor_address || 'No ingresada';

  // Rellenar datos registro
  document.getElementById('det-reg-code').textContent = reg.code_registration;
  document.getElementById('det-reg-date').textContent = reg.date_registration || 'No especificada';

  // Rellenar documentos
  const docList = document.getElementById('det-documents-list');
  docList.innerHTML = '';
  if (!reg.documents || reg.documents.length === 0) {
    docList.innerHTML = '<p style="color:var(--gray-600); font-style:italic;">No se adjuntaron documentos de respaldo.</p>';
  } else {
    reg.documents.forEach(doc => {
      const docLink = document.createElement('a');
      docLink.href = getApiUrl(doc.file_url);
      docLink.target = '_blank';
      docLink.className = 'form__group-item';
      docLink.style.cssText = 'padding: 8px 16px; font-size: 0.85rem; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; max-width: fit-content; margin-top: 4px;';
      docLink.innerHTML = `📄 Ver ${escapeHtml(doc.name)}`;
      docList.appendChild(docLink);
    });
  }

  // Vincular botón de confirmar en el modal
  const confirmBtn = document.getElementById('det-confirm-btn');
  confirmBtn.onclick = () => {
    closeDetailsModal();
    confirmarMatricula(reg.id);
  };

  // Mostrar modal
  document.getElementById('detailsModal').style.display = 'flex';
}

function closeDetailsModal() {
  document.getElementById('detailsModal').style.display = 'none';
}

// Confirmar matrícula
function confirmarMatricula(registrationId) {
  const reg = cachedPendingRegistrations.find(r => r.id === registrationId);

  // Si el grupo ya está lleno se advierte antes de confirmar, para que la
  // excepción sea una decisión consciente y no una sorpresa posterior.
  let mensaje = '¿Está seguro de confirmar esta matrícula? El estudiante quedará inscrito formalmente.';
  if (reg && reg.cupo_total && reg.cupo_confirmados >= reg.cupo_total) {
    mensaje = `El grupo ${reg.group_code} ya tiene ${reg.cupo_confirmados} de `
      + `${reg.cupo_total} cupos confirmados para el ciclo ${reg.anio_lectivo}.\n\n`
      + 'Puede confirmarla de todos modos como excepción. ¿Desea continuar?';
  }
  if (!confirm(mensaje)) return;

  apiFetch('/apiRegistration/Registration/ConfirmRegistration/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: registrationId })
  })
    .then(res => {
      if (!res.ok) {
        return res.json().then(errData => {
          throw new Error(errData.error || 'Error al confirmar la matrícula');
        });
      }
      return res.json();
    })
    .then(data => {
      showToast(data.message || 'Matrícula confirmada correctamente', 'success');
      // El cupo no bloquea, pero si se rebasó conviene que quede constancia
      // visible de que fue una excepción.
      if (data.aviso) showToast(data.aviso, 'warning');
      loadPendingRegistrations();
    })
    .catch(err => {
      console.error(err);
      showToast(err.message, 'error');
    });
}

// La configuración de matrícula ahora se maneja por ventana (Reingreso y
// Matrícula) en cargarVentanas() / guardarVentana(), al inicio de este archivo.
