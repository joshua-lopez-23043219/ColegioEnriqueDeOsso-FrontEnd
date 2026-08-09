/**
 * listadoEstudiantes.js
 * Carga directa de estudiantes de la base de datos, filtrado estricto por grupo ID y columnas alineadas.
 */

let allStudentsList = [];
let allGroupsList = [];

document.addEventListener('DOMContentLoaded', function () {
  loadGroups();
  loadAllStudents();

  // Event Listeners
  const groupFilter = document.getElementById('group-filter');
  if (groupFilter) {
    groupFilter.addEventListener('change', function () {
      filterStudentsByGroup(this.value);
    });
  }

  const editForm = document.getElementById('edit-student-form');
  if (editForm) {
    editForm.addEventListener('submit', handleEditSubmit);
  }

  const btnVerify = document.getElementById('btn-verify-user');
  if (btnVerify) {
    btnVerify.addEventListener('click', verifyUserAccount);
  }

  const btnReset = document.getElementById('btn-reset-password');
  if (btnReset) {
    btnReset.addEventListener('click', resetUserPassword);
  }
});

// Cargar todos los grupos en el selector de filtros
function loadGroups() {
  apiFetch('/apiGroup/Group/')
    .then(response => {
      if (!response.ok) throw new Error('Error al obtener los grupos');
      return response.json();
    })
    .then(groups => {
      allGroupsList = groups;
      const select = document.getElementById('group-filter');
      select.innerHTML = '<option value="ALL">Mostrar Todos los Grupos (553 Estudiantes)</option>';
      
      groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = `${group.code_group} - ${group.level_group} (${group.section_group})`;
        select.appendChild(option);
      });
    })
    .catch(error => {
      console.error(error);
    });
}

// Cargar todos los estudiantes de la base de datos
function loadAllStudents() {
  apiFetch('/apiStudent/Student/ListStudent/')
    .then(response => {
      if (!response.ok) throw new Error('Error al obtener el listado de estudiantes');
      return response.json();
    })
    .then(resData => {
      const records = resData.Record || resData || [];
      allStudentsList = records;
      
      const currentGroupVal = document.getElementById('group-filter')?.value || 'ALL';
      filterStudentsByGroup(currentGroupVal);
    })
    .catch(error => {
      console.error(error);
      showToast('❌ Error al cargar estudiantes de la base de datos', 'error');
    });
}

// Filtrar listado estricto por el id del grupo seleccionado
function filterStudentsByGroup(selectedGroupId) {
  if (!selectedGroupId || selectedGroupId === 'ALL') {
    renderStudentsTable(allStudentsList);
    return;
  }

  const numericGroupId = parseInt(selectedGroupId);
  const filtered = allStudentsList.filter(s => {
    return s.group === numericGroupId;
  });

  renderStudentsTable(filtered);
}

// Renderizar la tabla de estudiantes con 8 columnas perfectamente alineadas
function renderStudentsTable(students) {
  const section = document.getElementById('students-section');
  const tbody = document.getElementById('students-tbody');
  const noMessage = document.getElementById('no-students-message');
  const tableWrapper = document.getElementById('table-wrapper');
  const titleEl = document.getElementById('students-title');
  
  if (titleEl) {
    titleEl.textContent = `📋 Listado de Estudiantes (${students.length} Registros)`;
  }

  tbody.innerHTML = '';
  section.style.display = 'block';

  if (!students || students.length === 0) {
    noMessage.style.display = 'block';
    tableWrapper.style.display = 'none';
    return;
  }

  noMessage.style.display = 'none';
  tableWrapper.style.display = 'block';

  students.forEach(student => {
    const row = document.createElement('tr');
    row.className = 'form__table-fila';

    // 1. Celda Código Estudiante
    const cellCode = document.createElement('td');
    cellCode.className = 'form__table-campo';
    cellCode.innerHTML = `<strong>${escapeHtml(student.code_student)}</strong>`;
    row.appendChild(cellCode);

    // 2. Celda Nombre Completo Estudiante
    const cellName = document.createElement('td');
    cellName.className = 'form__table-campo';
    const constructedName = `${student.first_name || ''} ${student.second_name || ''} ${student.first_lastname || ''} ${student.second_lastname || ''}`.replace(/\s+/g, ' ').trim();
    const fullName = constructedName || `${student.name_student || ''} ${student.surname_student || ''}`.trim() || student.code_student;
    cellName.textContent = fullName;
    row.appendChild(cellName);

    // 3. Celda Sexo / Salud
    const cellHealth = document.createElement('td');
    cellHealth.className = 'form__table-campo';
    const genderBadge = student.gender === 'F' ? '<span style="color:#EC4899; font-weight:700;">(F)</span>' : '<span style="color:#3B82F6; font-weight:700;">(M)</span>';
    const healthText = student.health_condition && student.health_condition !== 'NINGUNO' ? `<span style="color:#D97706; font-weight:600;"><i class="ri-alert-line"></i> ${escapeHtml(student.health_condition)}</span>` : '<span style="color:#10B981;">Normal</span>';
    cellHealth.innerHTML = `${genderBadge} · ${healthText}`;
    row.appendChild(cellHealth);

    // 4. Celda Tutor / Responsable
    const cellTutor = document.createElement('td');
    cellTutor.className = 'form__table-campo';
    const tutorText = student.tutor_name ? `${student.tutor_name} ${student.tutor_phone ? '(' + student.tutor_phone + ')' : ''}` : 'Responsable Inscrito';
    cellTutor.textContent = tutorText;
    row.appendChild(cellTutor);

    // 5. Celda Grupo
    const cellGroup = document.createElement('td');
    cellGroup.className = 'form__table-campo';
    cellGroup.innerHTML = student.group_code ? `<span style="background:rgba(93,60,166,0.1); color:var(--primary); padding:3px 8px; border-radius:4px; font-weight:700; font-size:0.85rem;">${escapeHtml(student.group_code)}</span>` : '<span style="color:var(--gray-500);">Sin Grupo</span>';
    row.appendChild(cellGroup);

    // 6. Celda Solvencia (Alternar con un Click)
    const cellSolvency = document.createElement('td');
    cellSolvency.className = 'form__table-campo';
    const solvencyBtn = document.createElement('button');
    solvencyBtn.type = 'button';
    solvencyBtn.className = student.is_solvent ? 'action-btn action-btn--solvent' : 'action-btn action-btn--insolvent';
    solvencyBtn.title = student.is_solvent ? 'Estudiante Solvente - Clic para marcar Insolvente' : 'Estudiante Insolvente - Clic para marcar Solvente';
    
    if (student.is_solvent) {
      solvencyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 22px; height: 22px; color: #2ecc71;">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd" />
        </svg>`;
    } else {
      solvencyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 22px; height: 22px; color: #e74c3c;">
          <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd" />
        </svg>`;
    }

    solvencyBtn.addEventListener('click', () => {
      toggleSolvency(student.id, student.is_solvent);
    });
    cellSolvency.appendChild(solvencyBtn);
    row.appendChild(cellSolvency);

    // 7. Celda Acceso de Usuario
    const cellAccess = document.createElement('td');
    cellAccess.className = 'form__table-campo';

    if (student.has_user) {
      cellAccess.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 22px; height: 22px; color: #2ecc71; margin: auto;">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>`;
    } else {
      const keyBtn = document.createElement('button');
      keyBtn.type = 'button';
      keyBtn.className = 'action-btn action-btn--key';
      keyBtn.title = 'Crear cuenta de acceso para este Estudiante';
      keyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px; color: #5d3ca6;">
          <path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clip-rule="evenodd" />
        </svg>`;
      keyBtn.addEventListener('click', () => {
        generateUserAccount(student.code_student);
      });
      cellAccess.appendChild(keyBtn);
    }
    row.appendChild(cellAccess);

    // 8. Celda Acciones (Editar)
    const cellActions = document.createElement('td');
    cellActions.className = 'form__table-campo';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'action-btn';
    editBtn.title = 'Editar datos del estudiante';
    editBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px; color: #b8860b;">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>`;
    
    editBtn.addEventListener('click', () => {
      openEditModal(student);
    });

    cellActions.appendChild(editBtn);
    row.appendChild(cellActions);

    tbody.appendChild(row);
  });
}

// Alternar solvencia
function toggleSolvency(studentId, currentIsSolvent) {
  const newSolvency = !currentIsSolvent;
  apiFetch('/apiStudent/Student/SavePaymentStatus/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: studentId, is_solvent: newSolvency })
  })
  .then(res => {
    if (!res.ok) throw new Error('Error al actualizar solvencia');
    return res.json();
  })
  .then(data => {
    showToast(data.message || 'Solvencia actualizada con éxito', 'success');
    loadAllStudents();
  })
  .catch(err => {
    showToast('❌ Error al cambiar estado de solvencia', 'error');
  });
}

// Generar cuenta de acceso
function generateUserAccount(codeStudent) {
  apiFetch('/apiUserCreate/UsuarioCreate/create_student_user/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code_student: codeStudent })
  })
  .then(res => {
    if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Error al crear cuenta'); });
    return res.json();
  })
  .then(data => {
    document.getElementById('cred_username').textContent = data.username;
    document.getElementById('cred_password').textContent = data.temp_password || data.password;
    document.getElementById('credentialsModal').style.display = 'flex';
    showToast('Cuenta de usuario creada correctamente', 'success');
    loadAllStudents();
  })
  .catch(err => {
    showToast(`⚠️ ${err.message}`, 'error');
  });
}

function closeCredentialsModal() {
  document.getElementById('credentialsModal').style.display = 'none';
  const pwdSpan = document.getElementById('cred_password');
  const maskedSpan = document.getElementById('cred_password_masked');
  const btn = document.getElementById('btn_toggle_cred_password');
  if (pwdSpan && maskedSpan && btn) {
    pwdSpan.style.display = 'none';
    maskedSpan.style.display = 'inline';
    btn.textContent = 'Mostrar';
  }
}

function toggleCredPasswordVisibility() {
  const pwdSpan = document.getElementById('cred_password');
  const maskedSpan = document.getElementById('cred_password_masked');
  const btn = document.getElementById('btn_toggle_cred_password');
  if (pwdSpan.style.display === 'none') {
    pwdSpan.style.display = 'inline';
    maskedSpan.style.display = 'none';
    btn.textContent = 'Ocultar';
  } else {
    pwdSpan.style.display = 'none';
    maskedSpan.style.display = 'inline';
    btn.textContent = 'Mostrar';
  }
}

function copyCredentials() {
  const username = document.getElementById('cred_username').textContent;
  const password = document.getElementById('cred_password').textContent;
  const textToCopy = `Usuario (Código): ${username}\nContraseña Temporal: ${password}`;
  
  navigator.clipboard.writeText(textToCopy)
    .then(() => {
      showToast('Credenciales copiadas al portapapeles', 'success');
    })
    .catch(err => {
      showToast('No se pudo copiar automáticamente', 'warning');
    });
}

// Abrir el modal de edición de estudiante
function openEditModal(student) {
  document.getElementById('modal_student_id').value = student.id;
  document.getElementById('modal_code_student').value = student.code_student;
  document.getElementById('modal_name_student').value = student.name_student || student.first_name || '';
  document.getElementById('modal_surname_student').value = student.surname_student || student.first_lastname || '';
  document.getElementById('modal_birthday_student').value = student.birthday_student || '';
  document.getElementById('modal_phone_student').value = student.phone_student || '';
  document.getElementById('modal_email_student').value = student.email_student || '';

  const modal = document.getElementById('editStudentModal');
  modal.style.display = 'flex';
  
  const form = document.getElementById('edit-student-form');
  form.classList.remove('was-validated');
}

function closeEditModal() {
  document.getElementById('editStudentModal').style.display = 'none';
}

function handleEditSubmit(event) {
  event.preventDefault();
  
  const form = document.getElementById('edit-student-form');
  if (form.checkValidity() === false) {
    form.classList.add('was-validated');
    return;
  }

  const payload = {
    student_id: parseInt(document.getElementById('modal_student_id').value),
    code_student: document.getElementById('modal_code_student').value.trim(),
    name_student: document.getElementById('modal_name_student').value.trim(),
    surname_student: document.getElementById('modal_surname_student').value.trim(),
    birthday_student: document.getElementById('modal_birthday_student').value,
    phone_student: document.getElementById('modal_phone_student').value.trim(),
    email_student: document.getElementById('modal_email_student').value.trim()
  };

  apiFetch('/apiStudent/Student/UpdateStudent/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) throw new Error('Error al actualizar los datos del estudiante');
    return res.json();
  })
  .then(data => {
    showToast('✓ Estudiante actualizado con éxito', 'success');
    closeEditModal();
    loadAllStudents();
  })
  .catch(err => {
    showToast('❌ Error al actualizar el estudiante', 'error');
  });
}

window.showTab = function(tabNum) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.step-content').forEach(content => content.classList.remove('active'));

  const activeBtn = document.getElementById(`tab_btn_${tabNum}`);
  if (activeBtn) activeBtn.classList.add('active');

  const activeContent = document.getElementById(`step_${tabNum}`);
  if (activeContent) activeContent.classList.add('active');
};

function verifyUserAccount() {
  const code = document.getElementById('reset-student-code').value.trim().toUpperCase();
  const btnReset = document.getElementById('btn-reset-password');
  const resultPanel = document.getElementById('reset-result-panel');
  const resultTitle = document.getElementById('result-status-title');
  const resultContent = document.getElementById('result-details-content');

  if (!code) {
    showToast('Ingrese un código de estudiante', 'warning');
    return;
  }

  btnReset.style.display = 'none';
  resultPanel.style.display = 'none';

  apiFetch(`/apiUserCreate/UsuarioCreate/check_user_exists/?username=${encodeURIComponent(code)}`)
    .then(res => {
      if (!res.ok) throw new Error('Error al verificar la cuenta de usuario');
      return res.json();
    })
    .then(data => {
      resultPanel.style.display = 'block';
      if (data.exists) {
        resultTitle.textContent = '✅ Cuenta Activa Detectada';
        resultTitle.style.color = 'var(--success)';
        resultContent.innerHTML = `
          <p style="margin-bottom: 8px;"><strong>Nombre Real:</strong> ${escapeHtml(data.name)}</p>
          <p style="margin-bottom: 8px;"><strong>Usuario (Código):</strong> <span style="font-family: monospace; font-weight: bold; color: var(--primary-dark);">${escapeHtml(code)}</span></p>
          <p style="margin-bottom: 8px;"><strong>Rol en el Sistema:</strong> <span style="background: var(--primary-glow); color: var(--primary); padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;">${escapeHtml(data.role)}</span></p>
          <p style="margin-bottom: 12px;"><strong>Correo de Contacto:</strong> ${escapeHtml(data.email || 'No asignado')}</p>
          <p style="color: var(--gray-700); font-size: 0.9rem;">Si el usuario ha olvidado su contraseña, puede generar una nueva contraseña temporal a continuación.</p>
        `;
        btnReset.style.display = 'inline-flex';
      } else {
        resultTitle.textContent = '❌ Sin Cuenta de Acceso';
        resultTitle.style.color = 'var(--danger)';
        resultContent.innerHTML = `
          <p style="margin-bottom: 12px; color: var(--gray-700);">No se ha encontrado ninguna cuenta de usuario registrada bajo el código <strong style="color: var(--danger);">${escapeHtml(code)}</strong>.</p>
          <p style="font-size: 0.9rem;">Para crear una cuenta por primera vez, vaya a la pestaña <strong>Listado de Estudiantes</strong>, busque el estudiante y haga clic en el ícono de la llave (🔑).</p>
        `;
        btnReset.style.display = 'none';
      }
    })
    .catch(err => {
      showToast('No se pudo verificar la cuenta del estudiante', 'error');
    });
}

function resetUserPassword() {
  const code = document.getElementById('reset-student-code').value.trim().toUpperCase();
  if (!code) return;

  if (!confirm(`¿Está seguro de que desea restablecer la contraseña del usuario ${code}? La contraseña anterior dejará de funcionar de inmediato.`)) {
    return;
  }

  apiFetch('/apiUserCreate/UsuarioCreate/reset_user_password/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: code })
  })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.error || 'Error al restablecer la contraseña'); });
      }
      return res.json();
    })
    .then(data => {
      document.getElementById('cred_username').textContent = data.username;
      document.getElementById('cred_password').textContent = data.password;
      document.getElementById('credentialsModal').style.display = 'flex';
      
      document.getElementById('reset-student-code').value = '';
      document.getElementById('btn-reset-password').style.display = 'none';
      document.getElementById('reset-result-panel').style.display = 'none';
      
      showToast('Contraseña restablecida con éxito', 'success');
      loadAllStudents();
    })
    .catch(err => {
      showToast(err.message, 'error');
    });
}
