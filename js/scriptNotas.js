/**
 * scriptNotas.js — Grade registration logic
 * Implements: Tab switching, dynamic loading of groups/subjects,
 * activities management (modal, weight validation, total sum),
 * real-time UI calculation of grades, and student bulletin views.
 */


// ========== Tab Navigation ==========
function showNotesStep(stepNum) {
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

// ========== Initialize on DOM Load ==========
document.addEventListener('DOMContentLoaded', function () {
  loadInitialData();

  // Attach change event listener for teacher filter
  const notesTeacher = document.getElementById('notes_teacher');
  if (notesTeacher) {
    notesTeacher.addEventListener('change', function () {
      handleTeacherFilterChange(this.value);
    });
  }

  // Al cambiar de grupo hay que reducir las asignaturas a las de ESE grado
  // (cada materia existe una vez por grado).
  const notesGroup = document.getElementById('notes_group');
  if (notesGroup) {
    notesGroup.addEventListener('change', function () {
      populateSubjects('notes_subject', subjectsDisponibles, this.value);
    });
  }

  // Configure view based on role
  configureGradesView();
});

function configureGradesView() {
  const role = localStorage.getItem('user_role');
  if (role === 'TUTOR' || role === 'ESTUDIANTE') {
    const tab1Btn = document.getElementById('tab_btn_1');
    if (tab1Btn) tab1Btn.style.display = 'none';
    
    const tabsHeader = document.querySelector('.tabs-header');
    if (tabsHeader) tabsHeader.style.display = 'none';

    // Show Step 2
    showNotesStep(2);

    // Auto-fill student code and make read-only
    const studentCode = localStorage.getItem('student_code');
    const searchInput = document.getElementById('student_search_input');
    if (searchInput) {
      searchInput.value = studentCode;
      searchInput.readOnly = true;
      searchInput.style.backgroundColor = 'var(--gray-200)';
    }

    // Hide search controls
    const controls = document.querySelector('#step_2 .attendance-controls');
    if (controls) {
      controls.style.display = 'none';
    }

    // Auto load bulletin
    setTimeout(() => {
      loadStudentBulletin();
    }, 500);
  }
}

// Asignaturas disponibles segun el docente elegido (o todas). Se guarda
// aparte del filtro por grupo para poder combinar ambos.
let subjectsDisponibles = [];

// Normaliza para comparar sin tildes ni mayusculas ("9no" vs "9NO").
function _limpiar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

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
      populateTeachers('notes_teacher', allTeachers);
    })
    .catch(err => {
      console.error(err);
      showToast('No se pudieron cargar los docentes', 'error');
    });

  // Load Groups
  apiFetch('/apiGroup/Group/group_AutoList/')
    .then(res => {
      if (!res.ok) throw new Error('Error al cargar grupos');
      return res.json();
    })
    .then(groups => {
      allGroups = groups;
      populateGroups('notes_group', allGroups);
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
      subjectsDisponibles = allSubjects;
      populateSubjects('notes_subject', allSubjects, document.getElementById('notes_group')?.value);
    })
    .catch(err => {
      console.error(err);
      showToast('No se pudieron cargar las asignaturas', 'error');
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
 * Antes quitaba duplicados POR NOMBRE y se quedaba con el primero. Como cada
 * asignatura existe una vez por grado ("Creciendo en Valores desde el
 * Dialogo" tiene una fila para 7mo, otra para 8vo, etc.), eso dejaba una
 * sola de las cinco: al elegir un grupo de 9no se ofrecia la de 8vo y las
 * notas se habrian guardado contra la asignatura del grado equivocado.
 * Mismo arreglo que ya se aplico en Toma de Asistencia.
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
function handleTeacherFilterChange(teacherId) {
  const groupSelectId = 'notes_group';
  const subjectSelectId = 'notes_subject';

  if (!teacherId) {
    // Restore all options
    populateGroups(groupSelectId, allGroups);
    subjectsDisponibles = allSubjects;
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

      populateGroups(groupSelectId, groups);
      subjectsDisponibles = subjects;
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


// =========================================================
// TAB 1: Registro Acumulado (Actividades)
// =========================================================

let activeActivities = []; // [{ key: "temp_0", id: null, name: "Tarea 1", max_score: 20 }]
let activeStudents = [];    // [{ id_registration, code_student, name_student, scores: { key: score }, total }]
let tempKeyCounter = 0;

// Load activities and student list
function loadActivityGrades() {
  const groupId = document.getElementById('notes_group').value;
  const subjectId = document.getElementById('notes_subject').value;
  const partial = document.getElementById('notes_partial').value;

  if (!groupId || !subjectId || !partial) {
    showToast('Seleccione Grupo, Asignatura y Parcial', 'warning');
    return;
  }

  const url = `/apiNote/Note/GetActivityGrades/?id_group=${groupId}&id_subject=${subjectId}&partial=${partial}`;

  apiFetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Error al cargar notas de actividades');
      return res.json();
    })
    .then(response => {
      const data = response.Record || response;
      
      // Parse activities: give them a key property
      activeActivities = (data.activities || []).map(act => ({
        key: String(act.id),
        id: act.id,
        name: act.name,
        max_score: act.max_score
      }));

      // Parse students: structure their scores
      activeStudents = (data.students || []).map(st => {
        const scores = {};
        for (const [actId, score] of Object.entries(st.scores || {})) {
          scores[String(actId)] = parseFloat(score || 0.0);
        }
        return {
          id_registration: st.id_registration,
          code_student: st.code_student,
          name_student: st.name_student,
          scores: scores,
          total: parseFloat(st.total || 0.0)
        };
      });

      tempKeyCounter = 0;

      // Show activities section
      document.getElementById('activities-management-section').style.display = 'block';

      // Render badges and table
      renderActivitiesList();
      renderGradesTable();

      // Sin estudiantes no es un error de la pantalla: esta lista sale de las
      // MATRICULAS del ciclo en curso, no de los estudiantes asignados al
      // grupo. Un estudiante puede verse en "Listado de Estudiantes" y aun
      // asi no salir aqui si no tiene matricula de este año. Se avisa con
      // esas palabras para no dejar al usuario mirando una tabla vacia.
      if (activeStudents.length === 0) {
        showToast(
          'Este grupo no tiene estudiantes matriculados en el ciclo actual. ' +
          'Regístrelos en Matrícula para que aparezcan aquí.',
          'warning', 8000
        );
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Error al conectar con el servidor', 'error');
    });
}

// Render badges for activities
function renderActivitiesList() {
  const listContainer = document.getElementById('activities-badge-list');
  listContainer.innerHTML = '';

  let totalScore = 0;
  activeActivities.forEach((act, idx) => {
    totalScore += act.max_score;
    const badge = document.createElement('span');
    badge.className = 'badge-activity';
    badge.style.gap = '8px';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';

    // Left Arrow Button
    const leftArrow = idx > 0 
      ? `<span class="arrow-btn" onclick="moveActivity('${act.key}', 'left')" title="Mover a la izquierda" style="cursor: pointer; font-size: 0.85rem; color: var(--accent); user-select: none; padding: 2px 4px;">◀</span>`
      : '';

    // Right Arrow Button
    const rightArrow = idx < activeActivities.length - 1 
      ? `<span class="arrow-btn" onclick="moveActivity('${act.key}', 'right')" title="Mover a la derecha" style="cursor: pointer; font-size: 0.85rem; color: var(--accent); user-select: none; padding: 2px 4px;">▶</span>`
      : '';

    badge.innerHTML = `
      ${leftArrow}
      <span onclick="openEditActivityModal('${act.key}')" style="cursor: pointer;" title="Haga clic para editar nombre o puntaje">
        ${escapeHtml(act.name)} (${act.max_score} pts)
      </span>
      ${rightArrow}
      <span class="remove-btn" onclick="removeActivity('${act.key}')" title="Eliminar columna">&times;</span>
    `;
    listContainer.appendChild(badge);
  });

  document.getElementById('total-assigned-score').textContent = totalScore;

  // Warning if score exceeds 100
  const warning = document.getElementById('score-warning');
  if (totalScore > 100) {
    warning.style.display = 'inline';
    warning.textContent = `⚠️ ¡El puntaje total (${totalScore} pts) excede los 100 puntos permitidos!`;
  } else {
    warning.style.display = 'none';
  }
}

// Render grades table
function renderGradesTable() {
  const container = document.getElementById('grades-table-container');
  const saveArea = document.getElementById('grades-save-area');

  if (activeStudents.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <p><strong>Este grupo no tiene estudiantes matriculados en el ciclo actual.</strong></p>
        <p style="font-size: 0.88rem; color: var(--gray-600); margin-top: 6px; max-width: 460px;">
          Esta lista se arma con las <strong>matrículas del año en curso</strong>, no con los
          estudiantes asignados al grupo. Si el estudiante aparece en “Listado de Estudiantes”
          pero no aquí, es que le falta la matrícula de este ciclo: regístrela en
          <a href="registroMatricula.html" style="color: var(--primary); font-weight: 600;">Matrícula</a>.
        </p>
      </div>`;
    saveArea.style.display = 'none';
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="form__table">
        <thead>
        <tr class="form__table-fila">
          <th class="form__table-campo form__table-campo--header" style="width: 5%;">#</th>
          <th class="form__table-campo form__table-campo--header" style="text-align: left; padding-left: 12px; width: 30%;">Estudiante</th>
          <th class="form__table-campo form__table-campo--header" style="width: 15%;">Código</th>`;

  // Render headers for activities
  activeActivities.forEach(act => {
    html += `<th class="form__table-campo form__table-campo--header" style="min-width: 90px;" title="${escapeHtml(act.name)}">
      ${escapeHtml(act.name)}<br>(${act.max_score} pts)
    </th>`;
  });

  html += `
          <th class="form__table-campo form__table-campo--header" style="width: 15%; background: var(--primary-dark);">Nota Parcial (100)</th>
        </tr>
      </thead>
      <tbody>`;

  activeStudents.forEach((st, sIdx) => {
    html += `
      <tr class="form__table-fila" data-reg="${st.id_registration}">
        <td class="form__table-campo">${sIdx + 1}</td>
        <td class="form__table-campo" style="text-align: left; padding-left: 12px; font-weight: 500;">${escapeHtml(st.name_student)}</td>
        <td class="form__table-campo" style="font-size: 0.82rem; color: var(--gray-600);">${escapeHtml(st.code_student)}</td>`;

    // Render input for each activity
    activeActivities.forEach(act => {
      const val = st.scores[act.key] !== undefined ? st.scores[act.key] : '';
      html += `
        <td class="form__table-campo">
          <input type="number" class="form__input" value="${val}" min="0" max="${act.max_score}" step="0.5"
            oninput="updateStudentScore(${st.id_registration}, '${act.key}', this)" required>
        </td>`;
    });

    // Total cell
    const formattedTotal = st.total % 1 !== 0 ? st.total.toFixed(1) : st.total;
    html += `
        <td class="form__table-campo" id="total_reg_${st.id_registration}" style="font-weight: 700; color: var(--primary-dark); font-size: 0.95rem;">
          ${formattedTotal}
        </td>
      </tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
  saveArea.style.display = 'flex';
}

// Move activity left or right in the column order
function moveActivity(key, direction) {
  const index = activeActivities.findIndex(act => act.key === key);
  if (index === -1) return;

  if (direction === 'left' && index > 0) {
    // Swap with previous
    const temp = activeActivities[index];
    activeActivities[index] = activeActivities[index - 1];
    activeActivities[index - 1] = temp;
  } else if (direction === 'right' && index < activeActivities.length - 1) {
    // Swap with next
    const temp = activeActivities[index];
    activeActivities[index] = activeActivities[index + 1];
    activeActivities[index + 1] = temp;
  } else {
    return; // Out of bounds
  }

  renderActivitiesList();
  renderGradesTable();
  showToast('Orden de columnas actualizado', 'info');
}

// Modal Activity Handling
let editingActivityKey = null;

function openAddActivityModal() {
  document.getElementById('modal_act_name').value = '';
  document.getElementById('modal_act_score').value = '';
  
  const modal = document.getElementById('activity-modal');
  modal.querySelector('h2').textContent = 'Agregar Actividad';
  modal.querySelector('button[onclick="saveActivityFromModal()"]').textContent = 'Agregar';
  
  modal.style.display = 'flex';
}

function openEditActivityModal(key) {
  const act = activeActivities.find(a => a.key === key);
  if (!act) return;

  editingActivityKey = key;
  document.getElementById('modal_act_name').value = act.name;
  document.getElementById('modal_act_score').value = act.max_score;

  // Update modal title and button label
  const modal = document.getElementById('activity-modal');
  modal.querySelector('h2').textContent = 'Editar Actividad';
  modal.querySelector('button[onclick="saveActivityFromModal()"]').textContent = 'Guardar';

  modal.style.display = 'flex';
}

function closeAddActivityModal() {
  document.getElementById('activity-modal').style.display = 'none';
  editingActivityKey = null;
  
  const modal = document.getElementById('activity-modal');
  modal.querySelector('h2').textContent = 'Agregar Actividad';
  modal.querySelector('button[onclick="saveActivityFromModal()"]').textContent = 'Agregar';
}

function saveActivityFromModal() {
  const name = document.getElementById('modal_act_name').value.trim();
  const scoreVal = document.getElementById('modal_act_score').value.trim();

  if (!name || !scoreVal) {
    showToast('Complete todos los campos del modal', 'warning');
    return;
  }

  const maxScore = parseFloat(scoreVal);
  if (isNaN(maxScore) || maxScore <= 0 || maxScore > 100) {
    showToast('El puntaje debe ser un número entre 1 y 100', 'warning');
    return;
  }

  if (editingActivityKey !== null) {
    // Edit mode
    const actIdx = activeActivities.findIndex(a => a.key === editingActivityKey);
    if (actIdx === -1) return;

    // Calculate sum of other activities
    const otherSum = activeActivities.reduce((sum, a, idx) => sum + (idx === actIdx ? 0 : a.max_score), 0);
    if (otherSum + maxScore > 100) {
      showToast(`El puntaje excede el límite de 100 (Suma de otras: ${otherSum}, Nueva: ${maxScore})`, 'error');
      return;
    }

    // Update activity details
    activeActivities[actIdx].name = name;
    activeActivities[actIdx].max_score = maxScore;

    // Cap student grades at the new max score if necessary
    activeStudents.forEach(st => {
      if (st.scores[editingActivityKey] !== undefined) {
        st.scores[editingActivityKey] = Math.min(st.scores[editingActivityKey], maxScore);
      }
      // Recalculate total for student
      st.total = Object.values(st.scores).reduce((sum, val) => sum + (parseFloat(val) || 0.0), 0.0);
    });

    closeAddActivityModal();
    renderActivitiesList();
    renderGradesTable();
    showToast('Actividad actualizada', 'success');
  } else {
    // Add mode
    const currentSum = activeActivities.reduce((sum, act) => sum + act.max_score, 0);
    if (currentSum + maxScore > 100) {
      showToast(`El puntaje excede el límite de 100 (Suma actual: ${currentSum}, Nuevo: ${maxScore})`, 'error');
      return;
    }

    const key = `temp_${tempKeyCounter++}`;
    activeActivities.push({
      key: key,
      id: null,
      name: name,
      max_score: maxScore
    });

    activeStudents.forEach(st => {
      st.scores[key] = 0.0;
    });

    closeAddActivityModal();
    renderActivitiesList();
    renderGradesTable();
    showToast(`Actividad "${name}" agregada`, 'info');
  }
}

// Remove an activity column
function removeActivity(key) {
  activeActivities = activeActivities.filter(act => act.key !== key);
  activeStudents.forEach(st => {
    delete st.scores[key];
    // Recalculate total
    st.total = Object.values(st.scores).reduce((sum, val) => sum + (parseFloat(val) || 0.0), 0.0);
  });

  renderActivitiesList();
  renderGradesTable();
  showToast('Columna de actividad eliminada', 'info');
}

// Live student score updates
function updateStudentScore(registrationId, activityKey, input) {
  const val = input.value.trim();
  const score = parseFloat(val);
  const act = activeActivities.find(a => a.key === activityKey);

  if (!act) return;

  if (val === '' || isNaN(score) || score < 0 || score > act.max_score) {
    input.style.border = '2px solid var(--danger)';
    input.style.boxShadow = '0 0 0 3px rgba(231, 76, 60, 0.15)';
    return;
  }

  // Reset border
  input.style.border = '1px solid var(--gray-300)';
  input.style.boxShadow = 'none';

  // Save score in memory
  const student = activeStudents.find(st => st.id_registration === registrationId);
  if (student) {
    student.scores[activityKey] = score;
    // Calculate total
    student.total = Object.values(student.scores).reduce((sum, v) => sum + (parseFloat(v) || 0.0), 0.0);

    // Update total cell
    const cell = document.getElementById(`total_reg_${registrationId}`);
    if (cell) {
      cell.textContent = student.total % 1 !== 0 ? student.total.toFixed(1) : student.total;
    }
  }
}

// Save student activity grades
function saveActivityGrades() {
  const groupId = document.getElementById('notes_group').value;
  const subjectId = document.getElementById('notes_subject').value;
  const partial = document.getElementById('notes_partial').value;

  if (!groupId || !subjectId || !partial) {
    showToast('Filtros inválidos o incompletos', 'warning');
    return;
  }

  // Ensure total sum of max scores is exactly <= 100
  const totalWeight = activeActivities.reduce((sum, act) => sum + act.max_score, 0);
  if (totalWeight > 100) {
    showToast(`El peso de actividades (${totalWeight}) no puede superar los 100 puntos`, 'error');
    return;
  }

  // Verify there are no inputs marked with validation error
  const invalidInputs = document.querySelectorAll('#grades-table-container input[style*="2px solid var(--danger)"]');
  if (invalidInputs.length > 0) {
    showToast('Corrige los puntajes inválidos (color rojo) antes de guardar', 'warning');
    return;
  }

  const payload = {
    id_group: groupId,
    id_subject: subjectId,
    partial: partial,
    activities: activeActivities,
    grades: activeStudents.map(st => ({
      id_registration: st.id_registration,
      scores: st.scores
    }))
  };

  apiFetch('/apiNote/Note/SaveActivityGrades/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al guardar');
      return res.json();
    })
    .then(response => {
      showToast('Calificaciones guardadas y sincronizadas con el boletín', 'success');
      // Reload grades to sync DB IDs
      loadActivityGrades();
    })
    .catch(err => {
      console.error(err);
      showToast('Error al guardar las notas por actividades', 'error');
    });
}


// =========================================================
// TAB 2: Boletín del Estudiante (Reporte de Calificaciones)
// =========================================================

let currentBulletinStudent = null;
let currentBulletinGrades = [];

// Load bulletin grades for student
function loadStudentBulletin() {
  const searchInput = document.getElementById('student_search_input').value.trim();

  if (!searchInput) {
    showToast('Ingrese el código de un estudiante', 'warning');
    return;
  }

  const url = `/apiNote/Note/GetStudentBulletin/?code_student=${encodeURIComponent(searchInput)}`;

  apiFetch(url)
    .then(res => {
      if (!res.ok) {
        return res.json().then(errData => {
          throw new Error(errData.error || 'Error al cargar boletín');
        }).catch(err => {
          if (res.status === 404) throw new Error('Estudiante no encontrado o no matriculado');
          if (res.status === 402) throw new Error('Su boletín de calificaciones se encuentra bloqueado debido a mensualidades pendientes. Favor ponerse al día en el departamento de administración.');
          throw new Error(err.message || 'Error de servidor al cargar boletín');
        });
      }
      return res.json();
    })
    .then(response => {
      const data = response.Record || response;
      currentBulletinStudent = data.student;
      currentBulletinGrades = data.grades;

      // Render student details
      document.getElementById('bulletin_student_name').textContent = `Estudiante: ${data.student.name_student}`;
      document.getElementById('bulletin_student_code').textContent = data.student.code_student;
      document.getElementById('bulletin_student_shift').textContent = data.student.turno;
      document.getElementById('bulletin_student_level').textContent = data.student.level_group;
      document.getElementById('bulletin_student_section').textContent = data.student.section_group;

      document.getElementById('student-bulletin-info').style.display = 'block';

      // Render table
      renderBulletinTable(data.grades);
    })
    .catch(err => {
      console.error(err);
      showToast(err.message, 'error');
      // Clear views
      document.getElementById('student-bulletin-info').style.display = 'none';
      document.getElementById('bulletin-table-container').innerHTML = `
        <div class="layout__section" style="background: #F8D7DA; border: 1.5px solid #F5C6CB; color: #721C24; padding: 24px; border-radius: var(--radius-lg); text-align: center; margin: 20px auto; width: 100%;">
          <h2 style="font-family: var(--font-heading); margin-bottom: 12px; font-size: 1.25rem;">🔒 Acceso Bloqueado</h2>
          <p style="font-size: 0.95rem; font-weight: 500; line-height: 1.5; text-align: left;">${escapeHtml(err.message)}</p>
        </div>`;
      document.getElementById('bulletin-save-area').style.display = 'none';
    });
}

// Render bulletin scorecard table
/* ===== Escala cualitativa (MINED): AA / AS / AF / AI =====
   Algunas asignaturas se evalúan por categoría de logro en lugar de una nota
   numérica. Se promedian por su equivalencia 0-100 y el resultado se muestra
   otra vez como categoría, para no mezclar escalas en el boletín. */
const ESCALA_CUALITATIVA = ['AA', 'AS', 'AF', 'AI'];
const EQUIV_CUALITATIVA = { AA: 95, AS: 82.5, AF: 67.5, AI: 45 };

function cualitativaANumero(v) {
  return EQUIV_CUALITATIVA[String(v || '').trim().toUpperCase()] ?? null;
}

function numeroACualitativa(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  if (n >= 90) return 'AA';
  if (n >= 76) return 'AS';
  if (n >= 60) return 'AF';
  return 'AI';
}

/**
 * Descarga en Excel las notas del grupo seleccionado (todas las asignaturas).
 * Se usa un blob porque la petición necesita el token en la cabecera y no se
 * puede abrir la URL directamente.
 */
function exportarNotas() {
  const groupId = document.getElementById('notes_group').value;
  if (!groupId) {
    showToast('Seleccione un grupo primero', 'warning');
    return;
  }

  showToast('Generando archivo Excel…', 'info');
  apiFetch(`/apiAnalitica/Analitica/ExportarNotas/?id_group=${encodeURIComponent(groupId)}`)
    .then(res => {
      if (!res.ok) throw new Error('No se pudo generar el archivo');
      return res.blob().then(blob => ({ blob, nombre: _nombreDescarga(res, 'Notas.xlsx') }));
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
 * El valor que va en una celda del boletin.
 *
 * El backend separa lo numerico de lo cualitativo: en una asignatura que se
 * califica con letra, `first_partial` viene VACIO y la letra esta en
 * `first_partial_cual`. Leyendo solo el campo numerico esas materias salian
 * siempre en blanco -- y al guardar se enviaba ese vacio, que borraba la letra
 * que estaba guardada. Asi lo hace scriptBoletin.js, que es el correcto.
 */
function valorDe(g, campo) {
  return (g.es_cualitativa ? g[`${campo}_cual`] : g[campo]) || '';
}

/** Campo de captura de un parcial: <select> si es cualitativa, si no <input>. */
function campoParcial(g, idx, num, valor, habilitado) {
  const id = `p${num}_${idx}`;
  const dis = habilitado ? '' : 'disabled';
  if (g.es_cualitativa) {
    const opciones = ['<option value="">—</option>'].concat(
      ESCALA_CUALITATIVA.map(c => {
        const sel = String(valor || '').trim().toUpperCase() === c ? 'selected' : '';
        return `<option value="${c}" ${sel}>${c}</option>`;
      })).join('');
    return `<select class="form__control" id="${id}" onchange="recalcBulletinRow(${idx})"
      style="width: 72px; padding: 4px 6px; font-size: 0.85rem;" ${dis}>${opciones}</select>`;
  }
  return `<input type="text" class="form__input" id="${id}" value="${escapeHtml(valor || '')}"
    oninput="recalcBulletinRow(${idx})" style="width: 50px;" ${dis}>`;
}

function renderBulletinTable(grades) {
  const container = document.getElementById('bulletin-table-container');
  const saveArea = document.getElementById('bulletin-save-area');
  const role = localStorage.getItem('user_role');
  const isReadOnly = (role === 'TUTOR' || role === 'ESTUDIANTE');

  if (grades.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No hay materias asignadas para el año académico de este estudiante.</p>
      </div>`;
    saveArea.style.display = 'none';
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="form__table">
        <thead>
        <tr class="form__table-fila">
          <th class="form__table-campo form__table-campo--header" rowspan="2" style="text-align: left; padding-left: 12px; width: 35%;">Asignatura</th>
          <th class="form__table-campo form__table-campo--header" colspan="7">Periodos / Calificaciones (1-100)</th>
        </tr>
        <tr class="form__table-fila">
          <th class="form__table-campo form__table-campo--header" style="width: 8%;">I</th>
          <th class="form__table-campo form__table-campo--header" style="width: 8%;">II</th>
          <th class="form__table-campo form__table-campo--header" style="width: 10%; background: rgba(93,60,166,0.15); color: var(--primary-dark);">IS (Prom)</th>
          <th class="form__table-campo form__table-campo--header" style="width: 8%;">III</th>
          <th class="form__table-campo form__table-campo--header" style="width: 8%;">IV</th>
          <th class="form__table-campo form__table-campo--header" style="width: 10%; background: rgba(93,60,166,0.15); color: var(--primary-dark);">IIS (Prom)</th>
          <th class="form__table-campo form__table-campo--header" style="width: 13%; background: var(--primary-dark);">NF (Final)</th>
        </tr>
      </thead>
      <tbody>`;

  grades.forEach((g, idx) => {
    html += `
      <tr class="form__table-fila" data-sem1="${g.id_subject_sem1 || ''}" data-sem2="${g.id_subject_sem2 || ''}">
        <td class="form__table-campo" style="text-align: left; padding-left: 12px; font-weight: 500;">${escapeHtml(g.name_subject)}</td>
        
        <!-- I -->
        <td class="form__table-campo">
          ${campoParcial(g, idx, 1, valorDe(g, 'first_partial'), !isReadOnly && !!g.id_subject_sem1)}
        </td>

        <!-- II -->
        <td class="form__table-campo">
          ${campoParcial(g, idx, 2, valorDe(g, 'second_partial'), !isReadOnly && !!g.id_subject_sem1)}
        </td>
        
        <!-- IS (Readonly/calculated) -->
        <td class="form__table-campo" id="sem1_${idx}" style="font-weight: 600; background: var(--gray-50);">
          ${valorDe(g, 'first_semester')}
        </td>
        
        <!-- III -->
        <td class="form__table-campo">
          ${campoParcial(g, idx, 3, valorDe(g, 'third_partial'), !isReadOnly && !!g.id_subject_sem2)}
        </td>

        <!-- IV -->
        <td class="form__table-campo">
          ${campoParcial(g, idx, 4, valorDe(g, 'quarter_partial'), !isReadOnly && !!g.id_subject_sem2)}
        </td>
        
        <!-- IIS (Readonly/calculated) -->
        <td class="form__table-campo" id="sem2_${idx}" style="font-weight: 600; background: var(--gray-50);">
          ${valorDe(g, 'second_semester')}
        </td>
        
        <!-- NF (Readonly/calculated) -->
        <td class="form__table-campo" id="final_${idx}" style="font-weight: 700; color: var(--primary-dark); background: rgba(93,60,166,0.05);">
          ${valorDe(g, 'final_grade')}
        </td>
      </tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
  saveArea.style.display = isReadOnly ? 'none' : 'flex';
}

// Live calculation of row averages in the UI
function recalcBulletinRow(rowIdx) {
  // En asignaturas cualitativas los parciales son categorías (AA/AS/AF/AI):
  // se promedian por su equivalencia numérica y el resultado se muestra otra
  // vez como categoría.
  const esCualitativa = !!(currentBulletinGrades[rowIdx]
    && currentBulletinGrades[rowIdx].es_cualitativa);

  const getVal = (id) => {
    const el = document.getElementById(id);
    if (!el) return '';
    return el.value.trim();
  };

  const toFloat = (val) => {
    if (esCualitativa) return cualitativaANumero(val);
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  const format = (val) => {
    if (esCualitativa) return numeroACualitativa(val);
    return val % 1 !== 0 ? val.toFixed(1) : String(val);
  };

  const p1 = getVal(`p1_${rowIdx}`);
  const p2 = getVal(`p2_${rowIdx}`);
  const p3 = getVal(`p3_${rowIdx}`);
  const p4 = getVal(`p4_${rowIdx}`);

  const f1 = toFloat(p1);
  const f2 = toFloat(p2);
  const f3 = toFloat(p3);
  const f4 = toFloat(p4);

  // Validate range if entered
  [p1, p2, p3, p4].forEach((p, idx) => {
    const ids = [`p1_${rowIdx}`, `p2_${rowIdx}`, `p3_${rowIdx}`, `p4_${rowIdx}`];
    const el = document.getElementById(ids[idx]);
    if (!el) return;

    // El rango 0-100 solo aplica a notas numéricas; las cualitativas se eligen
    // de una lista cerrada, así que no pueden estar fuera de rango.
    if (!esCualitativa && p !== '') {
      const num = parseFloat(p);
      if (isNaN(num) || num < 0 || num > 100) {
        el.style.border = '2px solid var(--danger)';
        return;
      }
    }
    el.style.border = '1px solid var(--gray-300)';
  });

  // Calculate Semestre 1
  let sem1_val = null;
  if (p1 !== '' && p2 !== '') {
    sem1_val = ((f1 || 0.0) + (f2 || 0.0)) / 2.0;
    document.getElementById(`sem1_${rowIdx}`).textContent = format(sem1_val);
  } else {
    document.getElementById(`sem1_${rowIdx}`).textContent = '';
  }

  // Calculate Semestre 2
  let sem2_val = null;
  if (p3 !== '' && p4 !== '') {
    sem2_val = ((f3 || 0.0) + (f4 || 0.0)) / 2.0;
    document.getElementById(`sem2_${rowIdx}`).textContent = format(sem2_val);
  } else {
    document.getElementById(`sem2_${rowIdx}`).textContent = '';
  }

  // Calculate Final Grade
  if (sem1_val !== null && sem2_val !== null) {
    const final_val = (sem1_val + sem2_val) / 2.0;
    document.getElementById(`final_${rowIdx}`).textContent = format(final_val);
  } else {
    document.getElementById(`final_${rowIdx}`).textContent = '';
  }
}

// Save student bulletin final grades
function saveStudentBulletin() {
  if (!currentBulletinStudent) {
    showToast('No hay boletín de estudiante activo', 'warning');
    return;
  }

  // Ensure there are no invalid inputs
  const invalidInputs = document.querySelectorAll('#bulletin-table-container input[style*="2px solid var(--danger)"]');
  if (invalidInputs.length > 0) {
    showToast('Corrija las calificaciones inválidas antes de guardar', 'warning');
    return;
  }

  const grades = [];
  currentBulletinGrades.forEach((g, idx) => {
    const p1 = document.getElementById(`p1_${idx}`).value.trim();
    const p2 = document.getElementById(`p2_${idx}`).value.trim();
    const p3 = document.getElementById(`p3_${idx}`).value.trim();
    const p4 = document.getElementById(`p4_${idx}`).value.trim();

    grades.push({
      id_subject_sem1: g.id_subject_sem1,
      id_subject_sem2: g.id_subject_sem2,
      first_partial: p1,
      second_partial: p2,
      third_partial: p3,
      quarter_partial: p4,
      special_note: 0.0
    });
  });

  const payload = {
    id_registration: currentBulletinStudent.id_registration,
    grades: grades
  };

  apiFetch('/apiNote/Note/SaveStudentBulletin/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al guardar boletín');
      return res.json();
    })
    .then(response => {
      showToast('Boletín de calificaciones guardado exitosamente', 'success');
      loadStudentBulletin(); // Reload
    })
    .catch(err => {
      console.error(err);
      showToast('Error al guardar el boletín', 'error');
    });
}


// ========== Utility ==========
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}