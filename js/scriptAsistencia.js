/**
 * scriptAsistencia.js — Attendance module logic
 * Implements: Tab navigation, dynamic loading of groups/subjects,
 * student attendance table with P/A/J states, save/update, and history grid.
 */


// ========== Tab Navigation ==========
function showAttendanceStep(stepNum) {
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  const targetStep = document.getElementById(`step_${stepNum}`);
  const targetTab = document.getElementById(`tab_btn_${stepNum}`);
  if (targetStep) targetStep.classList.add('active');
  if (targetTab) targetTab.classList.add('active');
}

// ========== Global Data Cache ==========
let allGroups = [];
let allSubjects = [];
let allTeachers = [];

// Asignaturas disponibles según el docente elegido (o todas). Se guarda
// aparte del filtro por grupo para poder combinar ambos: docente ↓ grupo ↓.
let subjectsDisponibles = { att: [], hist: [] };

// Fecha de hoy según el reloj local. No se usa toISOString(): esa convierte
// a UTC y en Nicaragua (UTC-6) devolvería el día siguiente a partir de las
// 6 de la tarde, así que la asistencia se guardaría con fecha equivocada.
function hoyLocalISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Normaliza para comparar sin tildes ni mayúsculas ("9no" vs "9NO").
function _limpiar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// ========== Initialize on DOM Load ==========
document.addEventListener('DOMContentLoaded', function () {
  const dateInput = document.getElementById('att_date');
  if (dateInput) dateInput.value = hoyLocalISO();

  // Initialize data loading
  loadInitialData();

  // Attach change event listeners for teacher filters
  const attTeacher = document.getElementById('att_teacher');
  if (attTeacher) {
    attTeacher.addEventListener('change', function () {
      handleTeacherFilterChange('att', this.value);
    });
  }

  const histTeacher = document.getElementById('hist_teacher');
  if (histTeacher) {
    histTeacher.addEventListener('change', function () {
      handleTeacherFilterChange('hist', this.value);
    });
  }

  // Al cambiar de grupo hay que reducir las asignaturas a las de ESE grado.
  // Cada materia existe una vez por grado ("Creciendo en Valores" tiene una
  // fila para 7mo, otra para 8vo, etc.), así que sin este filtro se podía
  // pasar asistencia de 9no contra la asignatura de 8vo.
  ['att', 'hist'].forEach(prefijo => {
    const selectGrupo = document.getElementById(`${prefijo}_group`);
    if (selectGrupo) {
      selectGrupo.addEventListener('change', function () {
        populateSubjects(`${prefijo}_subject`, subjectsDisponibles[prefijo], this.value);
      });
    }
  });
});

// ========== Load Initial Data from API ==========
function loadInitialData() {
  // Load Teachers
  apiFetch('/apiTeacher/Teacher/ListTeacher/')
    .then(res => {
      if (!res.ok) throw new Error('Error al cargar docentes');
      return res.json();
    })
    .then(response => {
      allTeachers = response.Record || response;
      populateTeachers('att_teacher', allTeachers);
      populateTeachers('hist_teacher', allTeachers);
      fijarDocentePropio();
    })
    .catch(err => {
      console.error(err);
      showToast('No se pudieron cargar los docentes', 'error');
    });

  // Load Groups
  apiFetch('/apiGroup/Group/ListaGrupos/')
    .then(res => {
      if (!res.ok) throw new Error('Error al cargar grupos');
      return res.json();
    })
    .then(groups => {
      allGroups = groups;
      populateGroups('att_group', allGroups);
      populateGroups('hist_group', allGroups);
    })
    .catch(err => {
      console.error(err);
      showToast('No se pudieron cargar los grupos', 'error');
    });

  // Load Subjects
  apiFetch('/apiSubjects/Subjects/ListSubjects/')
    .then(res => {
      if (!res.ok) throw new Error('Error al cargar asignaturas');
      return res.json();
    })
    .then(response => {
      allSubjects = response.Record || response;
      subjectsDisponibles = { att: allSubjects, hist: allSubjects };
      populateSubjects('att_subject', allSubjects, document.getElementById('att_group')?.value);
      populateSubjects('hist_subject', allSubjects, document.getElementById('hist_group')?.value);
    })
    .catch(err => {
      console.error(err);
      showToast('No se pudieron cargar las asignaturas', 'error');
    });
}

/**
 * Un docente solo se ve a si mismo en el selector de docentes.
 *
 * `ListTeacher` devuelve a todo el personal porque las pantallas de horario
 * lo necesitan, pero aqui no tiene sentido: el docente pasa SU lista. Antes
 * veia a sus 16 colegas y podia elegir a cualquiera; el backend lo frenaba
 * al guardar con un 403 que no explicaba nada.
 */
function fijarDocentePropio() {
  if (localStorage.getItem('user_role') !== 'DOCENTE') return;
  const mio = localStorage.getItem('teacher_id');
  if (!mio) return;

  ['att_teacher', 'hist_teacher'].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    // Se deja SOLO su fila, sin el "Todos los docentes".
    const suya = Array.from(select.options).find(o => String(o.value) === String(mio));
    select.innerHTML = '';
    if (suya) select.appendChild(suya);
    select.value = mio;
    select.disabled = true;
    select.style.backgroundColor = 'var(--gray-100)';
    handleTeacherFilterChange(id.split('_')[0], mio);
  });
}

// ========== Populate Functions ==========
function populateTeachers(selectId, teachers) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">Todos los docentes</option>';
  teachers.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.code_teacher} - ${t.name_teacher}`;
    select.appendChild(opt);
  });
}

function populateGroups(selectId, groups) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="" disabled selected>Seleccione un grupo</option>';
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `${g.code_group} - ${g.level_group} (${g.section_group})`;
    select.appendChild(opt);
  });
}

/**
 * Llena el selector de asignaturas, limitado al grado del grupo elegido.
 *
 * Antes esta función quitaba duplicados POR NOMBRE y se quedaba con el
 * primero. Como cada asignatura existe una vez por grado ("Creciendo en
 * Valores desde el Diálogo" tiene una fila para 7mo, otra para 8vo, etc.),
 * eso dejaba una sola de las cinco: al elegir un grupo de 9no se ofrecía
 * "CVD-8vo", y la asistencia se guardaba contra la asignatura equivocada.
 *
 * Ahora se filtra por el grado real del grupo (`academic_subject` de la
 * asignatura contra `level_group` del grupo, igual que en Registro de
 * Horario). Si no calza ninguna, se muestran todas en vez de dejar el
 * selector vacío, para no bloquear al usuario si los datos están
 * incompletos.
 */
function populateSubjects(selectId, subjects, groupId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="" disabled selected>Seleccione asignatura</option>';

  const lista = subjects || [];
  const grupo = groupId
    ? allGroups.find(g => String(g.id) === String(groupId))
    : null;

  let disponibles = lista;
  if (grupo) {
    const nivel = _limpiar(grupo.level_group);
    const delGrado = lista.filter(s => _limpiar(s.academic_subject) === nivel);
    if (delGrado.length) disponibles = delGrado;
  }

  disponibles.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.code_subject} - ${s.name_subject}`;
    select.appendChild(opt);
  });
}

// ========== Handle Teacher Filter Change ==========
function handleTeacherFilterChange(prefix, teacherId) {
  const groupSelectId = `${prefix}_group`;
  const subjectSelectId = `${prefix}_subject`;

  if (!teacherId) {
    // Restore all options
    subjectsDisponibles[prefix] = allSubjects;
    populateGroups(groupSelectId, allGroups);
    populateSubjects(subjectSelectId, allSubjects, document.getElementById(groupSelectId)?.value);
    return;
  }

  // Fetch filtered lists from server
  apiFetch(`/apiImparte/Imparte/GetGroupsAndSubjectsByTeacher/?id_teacher=${teacherId}`)
    .then(res => {
      if (!res.ok) throw new Error('Error al filtrar por docente');
      return res.json();
    })
    .then(response => {
      const data = response.Record || response;
      const groups = data.groups || [];
      const subjects = data.subjects || [];

      subjectsDisponibles[prefix] = subjects;
      populateGroups(groupSelectId, groups);
      // Sin grupo elegido todavía: se muestran todas las del docente, y al
      // escoger grupo el listener las reduce al grado que corresponde.
      populateSubjects(subjectSelectId, subjects, document.getElementById(groupSelectId)?.value);

      if (groups.length === 0 && subjects.length === 0) {
        showToast('El docente seleccionado no tiene clases asignadas en el horario.', 'warning');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Error al filtrar las opciones del docente', 'error');
    });
}

// ========== BLOQUE 1: Toma de Asistencia ==========

// Current attendance data in memory
let currentStudents = [];

// Copia de la asistencia tal como está en la base, para saber si lo que se ve
// en pantalla tiene cambios todavía sin guardar.
let estadoGuardado = '';

function _instantanea(estudiantes) {
  return (estudiantes || []).map(s => `${s.id_registration}:${s.status}`).join('|');
}

function hayCambiosSinGuardar() {
  return _instantanea(currentStudents) !== estadoGuardado;
}

// Load attendance for selected group/subject/date
function loadAttendance() {
  const groupId = document.getElementById('att_group').value;
  const subjectId = document.getElementById('att_subject').value;
  const date = document.getElementById('att_date').value;

  if (!groupId || !subjectId || !date) {
    showToast('Seleccione Grupo, Asignatura y Fecha', 'warning');
    return;
  }

  const url = `/apiNon_Attendance/Non_Attendance/GetAttendance/?id_group=${groupId}&id_subject=${subjectId}&date=${date}`;

  apiFetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Error al cargar asistencia');
      return res.json();
    })
    .then(response => {
      const students = response.Record || response;
      currentStudents = students;
      estadoGuardado = _instantanea(students);
      renderAttendanceTable(students);
    })
    .catch(err => {
      console.error(err);
      showToast('Error al conectar con el servidor', 'error');
    });
}

// Render the student attendance table
function renderAttendanceTable(students) {
  const container = document.getElementById('attendance-table-container');
  const saveArea = document.getElementById('save-area');
  const quickActions = document.getElementById('quick-actions');
  const counter = document.getElementById('student-counter');

  if (!students || students.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <p>No hay estudiantes matriculados en este grupo.</p>
      </div>`;
    saveArea.style.display = 'none';
    quickActions.style.display = 'none';
    counter.style.display = 'none';
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="attendance-table">
        <thead>
        <tr>
          <th style="width: 8%;">#</th>
          <th style="width: 38%; text-align: left; padding-left: 14px;">Estudiante</th>
          <th style="width: 18%;">Código</th>
          <th style="width: 36%;">Estado</th>
        </tr>
      </thead>
      <tbody>`;

  students.forEach((s, idx) => {
    const isP = s.status === 'P' ? 'active-P' : '';
    const isA = s.status === 'A' ? 'active-A' : '';
    const isJ = s.status === 'J' ? 'active-J' : '';
    const isT = s.status === 'T' ? 'active-T' : '';

    html += `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(s.name_student)}</td>
          <td style="font-size: 0.82rem; color: var(--gray-600);">${escapeHtml(s.code_student)}</td>
          <td>
            <div class="status-group">
              <button type="button" class="status-btn ${isP}" data-reg="${s.id_registration}" data-status="P"
                onclick="setStatus(this, '${s.id_registration}', 'P')" title="Presente">✔</button>
              <button type="button" class="status-btn ${isA}" data-reg="${s.id_registration}" data-status="A"
                onclick="setStatus(this, '${s.id_registration}', 'A')" title="Ausente">✖</button>
              <button type="button" class="status-btn ${isJ}" data-reg="${s.id_registration}" data-status="J"
                onclick="setStatus(this, '${s.id_registration}', 'J')" title="Justificado">J</button>
              <button type="button" class="status-btn ${isT}" data-reg="${s.id_registration}" data-status="T"
                onclick="setStatus(this, '${s.id_registration}', 'T')" title="Tardanza">T</button>
            </div>
          </td>
        </tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;

  // Show UI elements
  saveArea.style.display = 'flex';
  quickActions.style.display = 'flex';
  counter.style.display = 'flex';
  document.getElementById('last-saved-info').textContent = '';

  updateCounters();
}

// Set status for a single student
function setStatus(btn, regId, newStatus) {
  // Find all buttons in the same row
  const row = btn.closest('tr');
  row.querySelectorAll('.status-btn').forEach(b => {
    b.classList.remove('active-P', 'active-A', 'active-J', 'active-T');
  });

  // Activate the clicked button
  btn.classList.add(`active-${newStatus}`);

  // Update in-memory data
  const student = currentStudents.find(s => String(s.id_registration) === String(regId));
  if (student) student.status = newStatus;

  updateCounters();
}

// Set all students to a given status
function setAllStatus(newStatus) {
  currentStudents.forEach(s => s.status = newStatus);

  // Update all buttons
  document.querySelectorAll('.status-group').forEach(group => {
    group.querySelectorAll('.status-btn').forEach(btn => {
      btn.classList.remove('active-P', 'active-A', 'active-J', 'active-T');
      if (btn.dataset.status === newStatus) {
        btn.classList.add(`active-${newStatus}`);
      }
    });
  });

  updateCounters();
  const NOMBRES_ESTADO = { P: 'Presente', A: 'Ausente', J: 'Justificado', T: 'Tardanza' };
  showToast(`Todos marcados como ${NOMBRES_ESTADO[newStatus] || newStatus}`, 'info');
}

// Update counter badges
function updateCounters() {
  let p = 0, a = 0, j = 0, t = 0;
  currentStudents.forEach(s => {
    if (s.status === 'P') p++;
    else if (s.status === 'A') a++;
    else if (s.status === 'J') j++;
    else if (s.status === 'T') t++;
  });

  document.getElementById('count-P').textContent = p;
  document.getElementById('count-A').textContent = a;
  document.getElementById('count-J').textContent = j;
  const badgeT = document.getElementById('count-T');
  if (badgeT) badgeT.textContent = t;
}

/**
 * Descarga la asistencia del grupo en Excel, con una fecha por columna.
 *
 * Va por asignatura porque cada docente pasa lista en su propia hora: sumar
 * todas las materias daría un total que mezcla clases distintas.
 *
 * `prefijo` indica de qué pestaña salen los selectores ('att' al pasar lista,
 * 'hist' al consultar el historial). La descarga se hace desde el blob porque
 * la petición necesita el token en la cabecera y no se puede abrir la URL.
 */
function exportarAsistencia(prefijo, desde, hasta) {
  const groupId = document.getElementById(`${prefijo}_group`).value;
  const subjectId = document.getElementById(`${prefijo}_subject`).value;
  if (!groupId || !subjectId) {
    showToast('Seleccione un grupo y una asignatura primero', 'warning');
    return;
  }

  let url = `/apiAnalitica/Analitica/ExportarAsistencia/?id_group=${encodeURIComponent(groupId)}`
    + `&id_subject=${encodeURIComponent(subjectId)}`;
  if (desde) url += `&desde=${encodeURIComponent(desde)}`;
  if (hasta) url += `&hasta=${encodeURIComponent(hasta)}`;

  showToast('Generando archivo Excel…', 'info');
  apiFetch(url)
    .then(res => {
      if (!res.ok) {
        return res.json()
          .then(e => { throw new Error(e.error || 'No se pudo generar el archivo'); })
          .catch(() => { throw new Error('No se pudo generar el archivo'); });
      }
      return res.blob().then(blob => ({ blob, nombre: _nombreDescarga(res) }));
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
      showToast('Archivo descargado', 'success');
    })
    .catch(err => showToast(err.message, 'error'));
}

/**
 * Exporta la lista que se acaba de pasar: solo la fecha en pantalla, no el
 * histórico completo.
 */
function exportarAsistenciaDelDia() {
  const fecha = document.getElementById('att_date').value;
  if (!fecha) {
    showToast('Seleccione una fecha primero', 'warning');
    return;
  }
  // El botón aparece con la lista cargada, que no implica haberla guardado.
  // Se exporta lo que hay en la base, así que conviene avisar si hay cambios
  // sin guardar para que el archivo no contradiga lo que se está viendo.
  if (hayCambiosSinGuardar() &&
      !confirm('Hay cambios sin guardar. El archivo contendrá la asistencia '
        + 'guardada, no lo que ve en pantalla.\n\n¿Desea exportar de todos modos?')) {
    return;
  }
  exportarAsistencia('att', fecha, fecha);
}

/** Exporta desde la pestaña de historial, con el rango indicado si lo hay. */
function exportarHistorial() {
  const desde = document.getElementById('hist_desde').value;
  const hasta = document.getElementById('hist_hasta').value;
  if (desde && hasta && hasta < desde) {
    showToast('La fecha final no puede ser anterior a la inicial', 'warning');
    return;
  }
  exportarAsistencia('hist', desde, hasta);
}

// Save attendance to the backend
function saveAttendance() {
  const subjectId = document.getElementById('att_subject').value;
  const date = document.getElementById('att_date').value;

  if (!subjectId || !date || currentStudents.length === 0) {
    showToast('No hay datos para guardar', 'warning');
    return;
  }

  const records = currentStudents.map(s => ({
    id_registration: s.id_registration,
    status: s.status
  }));

  const payload = {
    id_subject: subjectId,
    date: date,
    records: records
  };

  apiFetch('/apiNon_Attendance/Non_Attendance/SaveAttendance/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al guardar');
      return res.json();
    })
    .then(response => {
      const msg = response.Message || 'Asistencia guardada correctamente';
      showToast(msg, 'success');
      estadoGuardado = _instantanea(currentStudents);

      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('last-saved-info').textContent = `✅ Último guardado: ${timeStr}`;
    })
    .catch(err => {
      console.error(err);
      showToast('Error al guardar la asistencia', 'error');
    });
}


// ========== BLOQUE 2: Historial de Asistencia ==========

let historyData = null;

function loadHistory() {
  const groupId = document.getElementById('hist_group').value;
  const subjectId = document.getElementById('hist_subject').value;

  if (!groupId || !subjectId) {
    showToast('Seleccione Grupo y Asignatura para ver el historial', 'warning');
    return;
  }

  const url = `/apiNon_Attendance/Non_Attendance/GetGroupAttendanceHistory/?id_group=${groupId}&id_subject=${subjectId}`;

  apiFetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Error al cargar historial');
      return res.json();
    })
    .then(response => {
      historyData = response.Record || response;
      renderHistoryTable(historyData);
    })
    .catch(err => {
      console.error(err);
      showToast('Error al cargar el historial', 'error');
    });
}

function renderHistoryTable(data) {
  const container = document.getElementById('history-table-container');
  const dates = data.dates || [];
  const students = data.students || [];

  if (dates.length === 0 || students.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        <p>No se encontraron registros de asistencia para este grupo y asignatura.</p>
      </div>`;
    return;
  }

  // Format dates for header (short format)
  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  let html = `<div class="history-wrapper table-responsive"><table class="history-table" id="history-table-inner">
    <thead><tr>
      <th>#</th>
      <th style="text-align: left; padding-left: 10px;">Estudiante</th>`;

  dates.forEach(d => {
    html += `<th>${formatDate(d)}</th>`;
  });

  // Summary columns
  html += `<th style="background: var(--success-hover);">P</th>`;
  html += `<th style="background: var(--danger-hover);">A</th>`;
  html += `<th style="background: #e67e22;">J</th>`;
  html += `<th style="background: #2563EB;">T</th>`;
  html += `</tr></thead><tbody>`;

  students.forEach((s, idx) => {
    html += `<tr data-name="${escapeHtml(s.name_student).toLowerCase()}">
      <td>${idx + 1}</td>
      <td>${escapeHtml(s.name_student)}</td>`;

    let countP = 0, countA = 0, countJ = 0, countT = 0;
    dates.forEach(d => {
      const st = s.attendance[d] || '-';
      let chipClass = 'chip-none';
      let label = '-';

      if (st === 'P') { chipClass = 'chip-P'; label = '✔'; countP++; }
      else if (st === 'A') { chipClass = 'chip-A'; label = '✖'; countA++; }
      else if (st === 'J') { chipClass = 'chip-J'; label = 'J'; countJ++; }
      else if (st === 'T') { chipClass = 'chip-T'; label = 'T'; countT++; }

      html += `<td><span class="chip ${chipClass}">${label}</span></td>`;
    });

    html += `<td style="font-weight: 700; color: var(--success);">${countP}</td>`;
    html += `<td style="font-weight: 700; color: var(--danger);">${countA}</td>`;
    html += `<td style="font-weight: 700; color: var(--warning);">${countJ}</td>`;
    html += `<td style="font-weight: 700; color: var(--info);">${countT}</td>`;
    html += `</tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// Filter history table by student name
function filterHistory() {
  const query = document.getElementById('hist_search').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#history-table-inner tbody tr');

  rows.forEach(row => {
    const name = row.getAttribute('data-name') || '';
    row.style.display = name.includes(query) ? '' : 'none';
  });
}


// ========== Utility ==========
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}