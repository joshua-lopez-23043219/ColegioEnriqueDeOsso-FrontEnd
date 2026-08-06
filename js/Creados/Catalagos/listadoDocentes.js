/**
 * listadoDocentes.js
 * Lógica para el listado de docentes, edición, creación de cuenta de usuario y recuperación/restablecimiento de contraseña.
 */

document.addEventListener('DOMContentLoaded', function () {
  // Inicialización
  loadTeachers();

  // Event Listeners
  const editForm = document.getElementById('edit-teacher-form');
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

// Cache local de docentes cargados
let cachedTeachers = [];

// Obtener y listar todos los docentes
function loadTeachers() {
  const tbody = document.getElementById('teachers-tbody');
  const noMessage = document.getElementById('no-teachers-message');
  const tableWrapper = document.getElementById('table-wrapper');

  if (!tbody) return;

  apiFetch('/apiTeacher/Teacher/ListTeacher/')
    .then(response => {
      if (!response.ok) throw new Error('Error al obtener los docentes');
      return response.json();
    })
    .then(res => {
      const data = res.Record || res;
      cachedTeachers = data;

      tbody.innerHTML = '';
      if (data.length === 0) {
        if (noMessage) noMessage.style.display = 'block';
        if (tableWrapper) tableWrapper.style.display = 'none';
        return;
      }

      if (noMessage) noMessage.style.display = 'none';
      if (tableWrapper) tableWrapper.style.display = 'block';

      data.forEach(teacher => {
        const row = document.createElement('tr');
        row.className = 'form__table-fila';

        // Código
        const cellCode = document.createElement('td');
        cellCode.className = 'form__table-campo';
        cellCode.style.fontWeight = '600';
        cellCode.style.color = 'var(--primary-dark)';
        cellCode.textContent = teacher.code_teacher;
        row.appendChild(cellCode);

        // Nombre
        const cellName = document.createElement('td');
        cellName.className = 'form__table-campo';
        cellName.style.textAlign = 'left';
        cellName.style.paddingLeft = '12px';
        cellName.textContent = teacher.name_teacher;
        row.appendChild(cellName);

        // Área
        const cellArea = document.createElement('td');
        cellArea.className = 'form__table-campo';
        cellArea.textContent = teacher.area_teacher || 'General';
        row.appendChild(cellArea);

        // Contacto (Teléfono y Correo)
        const cellContact = document.createElement('td');
        cellContact.className = 'form__table-campo';
        cellContact.style.textAlign = 'left';
        cellContact.style.fontSize = '0.85rem';
        cellContact.innerHTML = `
          📞 ${escapeHtml(teacher.phone_teacher)}<br>
          ✉️ <small style="color:var(--primary);">${escapeHtml(teacher.email_teacher)}</small>
        `;
        row.appendChild(cellContact);

        // Acceso (Cuenta)
        const cellAccess = document.createElement('td');
        cellAccess.className = 'form__table-campo';

        if (teacher.has_user) {
          // Cuenta activa: checkmark verde
          cellAccess.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 22px; height: 22px; color: #2ecc71; margin: auto;">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>`;
        } else {
          // Llave 🔑 para crear la cuenta
          const keyBtn = document.createElement('button');
          keyBtn.type = 'button';
          keyBtn.className = 'action-btn action-btn--key';
          keyBtn.title = 'Crear cuenta de acceso para este Docente';
          keyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px; color: #5d3ca6;">
              <path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clip-rule="evenodd" />
            </svg>`;
          keyBtn.addEventListener('click', () => {
            generateUserAccount(teacher.code_teacher);
          });
          cellAccess.appendChild(keyBtn);
        }
        row.appendChild(cellAccess);

        // Acciones (Editar)
        const cellActions = document.createElement('td');
        cellActions.className = 'form__table-campo';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'action-btn';
        editBtn.title = 'Editar información del docente';
        editBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px; color: #b8860b;">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>`;
        editBtn.addEventListener('click', () => {
          openEditModal(teacher);
        });

        cellActions.appendChild(editBtn);
        row.appendChild(cellActions);

        tbody.appendChild(row);
      });
    })
    .catch(error => {
      console.error(error);
      showToast('❌ Error al obtener el listado de docentes', 'error');
    });
}

// Generar cuenta de acceso del docente
function generateUserAccount(codeTeacher) {
  apiFetch('/apiUserCreate/UsuarioCreate/create_teacher_user/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code_teacher: codeTeacher
    })
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => { throw new Error(err.error || 'Error al crear cuenta'); });
    }
    return res.json();
  })
  .then(data => {
    // Mostrar modal con las credenciales creadas
    document.getElementById('cred_username').textContent = data.username;
    document.getElementById('cred_password').textContent = data.temp_password;
    document.getElementById('credentialsModal').style.display = 'flex';
    showToast('Cuenta de docente creada correctamente', 'success');
    
    // Refrescar listado
    loadTeachers();
  })
  .catch(err => {
    console.error(err);
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
  const textToCopy = `Usuario (Docente): ${username}\nContraseña Temporal: ${password}`;
  
  navigator.clipboard.writeText(textToCopy)
    .then(() => {
      showToast('Credenciales copiadas al portapapeles', 'success');
    })
    .catch(err => {
      console.error('Error al copiar: ', err);
      showToast('No se pudo copiar automáticamente', 'warning');
    });
}

// Abrir el modal de edición de docente
function openEditModal(teacher) {
  document.getElementById('modal_teacher_id').value = teacher.id;
  document.getElementById('modal_code_teacher').value = teacher.code_teacher;
  document.getElementById('modal_name_teacher').value = teacher.name_teacher;
  document.getElementById('modal_area_teacher').value = teacher.area_teacher || '';
  document.getElementById('modal_phone_teacher').value = teacher.phone_teacher || '';
  document.getElementById('modal_email_teacher').value = teacher.email_teacher || '';
  document.getElementById('modal_address_teacher').value = teacher.address_teacher || '';

  const modal = document.getElementById('editTeacherModal');
  modal.style.display = 'flex';
  
  // Limpiar clases de validación previa
  const form = document.getElementById('edit-teacher-form');
  form.classList.remove('was-validated');
}

// Cerrar el modal de edición
function closeEditModal() {
  document.getElementById('editTeacherModal').style.display = 'none';
}

// Enviar los cambios del docente editado
function handleEditSubmit(event) {
  event.preventDefault();
  
  const form = document.getElementById('edit-teacher-form');
  if (form.checkValidity() === false) {
    form.classList.add('was-validated');
    return;
  }

  const payload = {
    id: parseInt(document.getElementById('modal_teacher_id').value),
    code_teacher: document.getElementById('modal_code_teacher').value.trim(),
    name_teacher: document.getElementById('modal_name_teacher').value.trim(),
    area_teacher: document.getElementById('modal_area_teacher').value.trim(),
    phone_teacher: document.getElementById('modal_phone_teacher').value.trim(),
    email_teacher: document.getElementById('modal_email_teacher').value.trim(),
    address_teacher: document.getElementById('modal_address_teacher').value.trim()
  };

  apiFetch('/apiTeacher/Teacher/UpdateTeacher/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) throw new Error('Error al actualizar los datos del docente');
    return res.json();
  })
  .then(data => {
    showToast('✓ Docente actualizado con éxito', 'success');
    closeEditModal();
    loadTeachers();
  })
  .catch(err => {
    console.error(err);
    showToast('❌ Error al actualizar la información del docente', 'error');
  });
}

// Declarar showTab en el scope global
window.showTab = function(tabNum) {
  // Desactivar todas las pestañas y contenidos
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.step-content').forEach(content => content.classList.remove('active'));

  // Activar seleccionada
  const activeBtn = document.getElementById(`tab_btn_${tabNum}`);
  if (activeBtn) activeBtn.classList.add('active');

  const activeContent = document.getElementById(`step_${tabNum}`);
  if (activeContent) activeContent.classList.add('active');
};

// Verificar cuenta en pestaña 2
function verifyUserAccount() {
  const code = document.getElementById('reset-teacher-code').value.trim().toUpperCase();
  const btnReset = document.getElementById('btn-reset-password');
  const resultPanel = document.getElementById('reset-result-panel');
  const resultTitle = document.getElementById('result-status-title');
  const resultContent = document.getElementById('result-details-content');

  if (!code) {
    showToast('Ingrese un código de docente', 'warning');
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
          <p style="color: var(--gray-700); font-size: 0.9rem;">Si el docente ha olvidado su contraseña, puede generar una nueva contraseña temporal a continuación.</p>
        `;
        btnReset.style.display = 'inline-flex';
      } else {
        resultTitle.textContent = '❌ Sin Cuenta de Acceso';
        resultTitle.style.color = 'var(--danger)';
        resultContent.innerHTML = `
          <p style="margin-bottom: 12px; color: var(--gray-700);">No se ha encontrado ninguna cuenta de usuario registrada bajo el código <strong style="color: var(--danger);">${escapeHtml(code)}</strong>.</p>
          <p style="font-size: 0.9rem;">Para crear una cuenta por primera vez, vaya a la pestaña <strong>Listado de Docentes</strong> y haga clic en el ícono de la llave (🔑) al lado del docente correspondiente.</p>
        `;
        btnReset.style.display = 'none';
      }
    })
    .catch(err => {
      console.error(err);
      showToast('No se pudo verificar la cuenta del docente', 'error');
    });
}

// Restablecer contraseña del docente
function resetUserPassword() {
  const code = document.getElementById('reset-teacher-code').value.trim().toUpperCase();
  if (!code) return;

  if (!confirm(`¿Está seguro de que desea restablecer la contraseña del docente ${code}? La contraseña anterior dejará de funcionar de inmediato.`)) {
    return;
  }

  apiFetch('/apiUserCreate/UsuarioCreate/reset_teacher_password/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code_teacher: code })
  })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.error || 'Error al restablecer la contraseña'); });
      }
      return res.json();
    })
    .then(data => {
      // Mostrar popup con la nueva credencial generada
      document.getElementById('cred_username').textContent = data.username;
      document.getElementById('cred_password').textContent = data.password;
      document.getElementById('credentialsModal').style.display = 'flex';
      
      // Limpiar/refrescar pantalla de verificación
      document.getElementById('reset-teacher-code').value = '';
      document.getElementById('btn-reset-password').style.display = 'none';
      document.getElementById('reset-result-panel').style.display = 'none';
      
      showToast('Contraseña de docente restablecida con éxito', 'success');
      loadTeachers();
    })
    .catch(err => {
      console.error(err);
      showToast(err.message, 'error');
    });
}
