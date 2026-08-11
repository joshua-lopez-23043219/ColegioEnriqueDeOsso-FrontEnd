/**
 * scriptMatricula.js — Enrollment registration with API integration and Multi-step Tabs UX
 */

// Navegación por pasos (Bloques)
function showStep(stepNum) {
  // Ocultar todos los pasos
  document.querySelectorAll('.step-content').forEach(el => {
    el.classList.remove('active');
  });
  // Desactivar todos los botones de pestaña
  document.querySelectorAll('.tab-btn').forEach(el => {
    el.classList.remove('active');
  });

  // Activar el paso y pestaña correspondiente
  const targetStep = document.getElementById(`step_${stepNum}`);
  const targetTab = document.getElementById(`tab_btn_${stepNum}`);
  if (targetStep) targetStep.classList.add('active');
  if (targetTab) targetTab.classList.add('active');
}

// Modal Documentos
function AbrirModalDocumentos() {
  document.getElementById("modalDocumentos").style.display = "flex";
}

// Cerrar Modal Documentos
function CerrarModalDocumentos() {
  document.getElementById("modalDocumentos").style.display = "none";
}

// Cerrar si hacen clic fuera del modal
window.addEventListener("click", function (event) {
  const modal = document.getElementById("modalDocumentos");
  if (event.target == modal) {
    CerrarModalDocumentos();
  }
});

// Aceptar documento en el modal
function AceptarDocumento() {
  const nameDoc = document.getElementById("name_document").value.trim();
  const fileInput = document.getElementById("file");

  if (!nameDoc) {
    showToast("Por favor, ingrese el nombre del documento", "warning");
    return;
  }
  if (fileInput.files.length === 0) {
    showToast("Por favor, seleccione un archivo PDF", "warning");
    return;
  }

  const badge = document.getElementById("document_badge");
  const docNameSpan = document.getElementById("loaded_doc_name");
  
  if (badge && docNameSpan) {
    docNameSpan.textContent = `${nameDoc} (${fileInput.files[0].name})`;
    badge.style.display = "block";
  }

  CerrarModalDocumentos();
  showToast("📄 Documento adjuntado correctamente", "success");
}

// Generar código correlativo de matrícula MAT-0000 de forma optimizada
function loadNextRegistrationCode() {
  apiFetch('/apiRegistration/Registration/GetNextRegistrationCode/')
    .then(response => {
      if (!response.ok) throw new Error("No se pudo obtener el código correlativo de matrícula");
      return response.json();
    })
    .then(data => {
      document.getElementById("code_registration").value = data.next_code;
    })
    .catch(error => {
      console.error(error);
      // Fallback
      document.getElementById("code_registration").value = "MAT-0001";
      showToast("⚠️ Se usó código 'MAT-0001' por defecto (error al contactar al servidor)", "warning");
    });
}

// Auto-completar fecha de matrícula al día actual.
// No se usa toISOString(): esa convierte a UTC y en Nicaragua (UTC-6) a
// partir de las 6 de la tarde devolvía la fecha del día siguiente, así que
// las matrículas de la tarde quedaban con la fecha equivocada.
function setTodayDate() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  document.getElementById("date_registration").value = `${d.getFullYear()}-${mes}-${dia}`;

  // El ciclo lectivo arranca en el año en curso; el personal puede cambiarlo
  // al capturar una ficha en papel de otro año.
  const campoCiclo = document.getElementById("anio_lectivo");
  if (campoCiclo && !campoCiclo.value) campoCiclo.value = d.getFullYear();
}

// Escribe un valor en un campo de solo lectura, tolerando que no exista.
function _fijar(id, valor) {
  const campo = document.getElementById(id);
  if (campo) campo.value = valor || '';
}

// Buscar estudiante por código (Tecla Enter)
document.getElementById("code_student").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const code = this.value.trim();

    if (!code) {
      showToast("Ingrese un código de estudiante para buscar", "warning");
      return;
    }

    apiFetch(`/apiStudent/Student/SpecificStudent/?code_student=${encodeURIComponent(code)}`)
      .then(response => {
        if (!response.ok) throw new Error("Estudiante no encontrado en la base de datos");
        return response.json();
      })
      .then(dataST => {
        document.getElementById('code_student').value = dataST.code_student;
        document.getElementById('name_student').value = dataST.name_student;
        document.getElementById('surname_student').value = dataST.surname_student;
        document.getElementById('birthday_student').value = dataST.birthday_student;
        document.getElementById('phone_student').value = dataST.phone_student;
        document.getElementById('email_student').value = dataST.email_student;
        // Datos de la ficha del estudiante que antes no se veian al matricular
        _fijar('gender_student', dataST.gender === 'F' ? 'Femenino (F)' : 'Masculino (M)');
        _fijar('nationality_student', dataST.nationality);
        _fijar('religion_student', dataST.religion);
        _fijar('health_student', dataST.health_condition);
        _fijar('address_student', dataST.address);
        _fijar('siblings_student', dataST.siblings_info);
        document.getElementById("id_student").value = dataST.id;
        
        showToast("Estudiante encontrado correctamente", "success");
      })
      .catch(error => {
        showToast(error.message, "error");
        document.getElementById("name_student").value = '';
        document.getElementById("surname_student").value = '';
        document.getElementById("birthday_student").value = '';
        document.getElementById("phone_student").value = '';
        document.getElementById("email_student").value = '';
        ['gender_student', 'nationality_student', 'religion_student',
         'health_student', 'address_student', 'siblings_student'].forEach(id => _fijar(id, ''));
        document.getElementById("id_student").value = '';
      });
  }
});

// Buscar tutor por número de identidad / cédula (Tecla Enter)
document.getElementById("code_tutor").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const code = this.value.trim();

    if (!code) {
      showToast("Ingrese la cédula del tutor para buscar", "warning");
      return;
    }

    apiFetch(`/apiMentor/Mentor/SpecificMentor/?code_tutor=${encodeURIComponent(code)}`)
      .then(response => {
        if (!response.ok) throw new Error("Tutor no encontrado en la base de datos");
        return response.json();
      })
      .then(dataTR => {
        document.getElementById('code_tutor').value = dataTR.code_tutor;
        document.getElementById('name_tutor').value = dataTR.name_tutor;
        document.getElementById('surname_tutor').value = dataTR.surname_tutor;
        document.getElementById('birthdate_tutor').value = dataTR.birthdate_tutor;
        document.getElementById('phone_tutor').value = dataTR.phone_tutor;
        document.getElementById('email_tutor').value = dataTR.email_tutor;
        document.getElementById('address_tutor').value = dataTR.address_tutor;
        _fijar('document_tutor', dataTR.id_document_number);
        _fijar('nationality_tutor', dataTR.nationality);
        _fijar('religion_tutor', dataTR.religion);
        document.getElementById("id_tutor").value = dataTR.id;
        
        showToast("Tutor encontrado correctamente", "success");
      })
      .catch(error => {
        showToast(error.message, "error");
        document.getElementById("name_tutor").value = '';
        document.getElementById("surname_tutor").value = '';
        document.getElementById("birthdate_tutor").value = '';
        document.getElementById("phone_tutor").value = '';
        document.getElementById("email_tutor").value = '';
        document.getElementById("address_tutor").value = '';
        ['document_tutor', 'nationality_tutor', 'religion_tutor'].forEach(id => _fijar(id, ''));
        document.getElementById("id_tutor").value = '';
      });
  }
});

let allGroups = [];

// Cargar grupos en el selector al cargar la página
window.addEventListener("DOMContentLoaded", function () {
  setTodayDate();
  loadNextRegistrationCode();

  const groupSelect = document.getElementById("group_select");
  const idGroupInput = document.getElementById("id_group");

  if (!groupSelect || !idGroupInput) {
    console.error("No se encontró el campo de grupo o el input oculto.");
    return;
  }

  apiFetch('/apiGroup/Group/group_AutoList/')
    .then(response => {
      if (!response.ok) throw new Error("Error al cargar grupos");
      return response.json();
    })
    .then(groups => {
      allGroups = groups;
      populateFilteredGroups();

      groupSelect.addEventListener("change", function () {
        idGroupInput.value = this.value;
      });
    })
    .catch(error => {
      showToast("No se pudieron cargar los grupos desde la base de datos", "error");
    });

  // Listen to level select changes to filter groups
  const levelSelect = document.getElementById('level_registration');
  if (levelSelect) {
    levelSelect.addEventListener('change', populateFilteredGroups);
  }

  // Check role and configure views
  configureEnrollmentView();
});

function populateFilteredGroups() {
  const levelSelect = document.getElementById('level_registration');
  const groupSelect = document.getElementById('group_select');
  if (!levelSelect || !groupSelect) return;

  const selectedLevel = levelSelect.value;
  groupSelect.innerHTML = '<option value="" disabled selected>Seleccione un grupo</option>';
  
  const filtered = allGroups.filter(g => !selectedLevel || g.level_group === selectedLevel);
  filtered.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = `${group.code_group} - ${group.level_group} (${group.section_group})`;
    groupSelect.appendChild(option);
  });
}

function configureEnrollmentView() {
  const role = localStorage.getItem('user_role');
  
  if (role !== 'TUTOR') return;

  // If Tutor:
  // 1. Make code inputs read-only
  const studentInput = document.getElementById('code_student');
  const tutorInput = document.getElementById('code_tutor');
  if (studentInput) {
    studentInput.readOnly = true;
    studentInput.style.backgroundColor = 'var(--gray-200)';
  }
  if (tutorInput) {
    tutorInput.readOnly = true;
    tutorInput.style.backgroundColor = 'var(--gray-200)';
  }

  const studentCode = localStorage.getItem('student_code');
  if (!studentCode) {
    showToast('Falta el código de estudiante en la sesión. Consulte a la administración.', 'error');
    return;
  }

  // 2. Check student registration
  apiFetch(`/apiRegistration/Registration/CheckStudentEnrollment/?code_student=${encodeURIComponent(studentCode)}`)
    .then(res => {
      if (!res.ok) throw new Error('Error al verificar estado de matrícula');
      return res.json();
    })
    .then(data => {
      const banner = document.getElementById('enrollment-status-banner');
      const mainLayout = document.getElementById('matricula-main-layout');

      if (data.enrolled) {
        // Hide form and show banner
        if (mainLayout) mainLayout.style.display = 'none';
        if (banner) {
          banner.style.display = 'block';
          const reg = data.registration;
          if (reg.status_registration === 'PENDIENTE') {
            banner.innerHTML = `
              <div class="layout__section" style="background: #FFF3CD; border: 1.5px solid #FFEBA8; color: #856404; padding: 24px; border-radius: var(--radius-lg); text-align: center; max-width: 800px; margin: auto;">
                <h2 style="font-family: var(--font-heading); margin-bottom: 12px; font-size: 1.3rem;">⏳ Matrícula en Proceso de Confirmación</h2>
                <p style="font-size: 1rem; font-weight: 500; line-height: 1.5;">Su matrícula se encuentra registrada para el periodo <strong>${reg.level_registration}</strong> y a la espera de la confirmación por el departamento de administración.</p>
              </div>`;
          } else {
            banner.innerHTML = `
              <div class="layout__section" style="background: #E8F5E9; border: 1.5px solid #C8E6C9; color: #2E7D32; padding: 24px; border-radius: var(--radius-lg); text-align: center; max-width: 800px; margin: auto;">
                <h2 style="font-family: var(--font-heading); margin-bottom: 12px; font-size: 1.3rem;">✓ Matrícula Completada con Éxito</h2>
                <p style="font-size: 1rem; font-weight: 500; line-height: 1.5; color: #1B5E20;">Matrícula Ordinaria de Grado Correspondiente al Periodo 2026-1.<br><strong>¡Ya se ha realizado la matrícula en línea!</strong></p>
              </div>`;
          }
        }
      } else {
        // Not enrolled -> check if window is open
        apiFetch('/apiUserCreate/UsuarioCreate/GetEnrollmentWindow/')
          .then(res => {
            if (!res.ok) throw new Error('Error al consultar ventana de matrícula');
            return res.json();
          })
          .then(windowData => {
            if (!windowData.enabled) {
              // Enrollment is closed
              if (mainLayout) mainLayout.style.display = 'none';
              if (banner) {
                banner.style.display = 'block';
                banner.innerHTML = `
                  <div class="layout__section" style="background: #F8D7DA; border: 1.5px solid #F5C6CB; color: #721C24; padding: 24px; border-radius: var(--radius-lg); text-align: center; max-width: 800px; margin: auto;">
                    <h2 style="font-family: var(--font-heading); margin-bottom: 12px; font-size: 1.3rem;">⚠️ Matrícula Inhabilitada</h2>
                    <p style="font-size: 1rem; font-weight: 500; line-height: 1.5;">La matrícula en línea se encuentra inhabilitada actualmente. Favor consultar con la administración.</p>
                  </div>`;
              }
            } else {
              // Open! Auto-fill student and trigger search
              if (studentInput) {
                studentInput.value = studentCode;
                // Dispatch enter keydown to fetch details
                setTimeout(() => {
                  const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
                  studentInput.dispatchEvent(enterEvent);
                }, 500);
              }
              
              // Also fetch tutor details if we have tutor_id
              const tutorId = localStorage.getItem('tutor_id');
              if (tutorId && tutorId !== 'null') {
                apiFetch(`/apiMentor/Mentor/${tutorId}/`)
                  .then(res => res.json())
                  .then(mentorData => {
                    if (tutorInput) {
                      tutorInput.value = mentorData.code_tutor;
                      setTimeout(() => {
                        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
                        tutorInput.dispatchEvent(enterEvent);
                      }, 1000);
                    }
                  })
                  .catch(err => console.error('Error auto-loading tutor details:', err));
              }
            }
          })
          .catch(err => showToast(err.message, 'error'));
      }
    })
    .catch(err => showToast(err.message, 'error'));
}

// Guardar matrícula completa
function guardarMatricula() {
  const form = document.getElementById('form_matricula');

  const idStudent = document.getElementById('id_student').value;
  const idTutor = document.getElementById('id_tutor').value;
  const idGroup = document.getElementById('id_group').value;

  if (!idStudent || isNaN(idStudent)) {
    showToast("Falta cargar los datos del Estudiante en el Paso 2", "warning");
    showStep(2);
    return;
  }

  if (!idTutor || isNaN(idTutor)) {
    showToast("Falta cargar los datos del Tutor en el Paso 3", "warning");
    showStep(3);
    return;
  }

  if (!idGroup || isNaN(idGroup)) {
    showToast("Debe seleccionar un grupo en el Paso 4", "warning");
    showStep(4);
    return;
  }

  const requiredFields = [
    'code_registration', 'date_registration', 'mode_registration',
    'level_registration', 'name_document', 'file'
  ];

  for (const fieldId of requiredFields) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value || (field.type === 'file' && field.files.length === 0)) {
      if (fieldId === 'name_document' || fieldId === 'file') {
        showToast("Debe adjuntar el Documento PDF en el Paso 2", "warning");
        showStep(2);
      } else {
        showToast("Por favor complete todos los campos obligatorios del Paso 1", "warning");
        showStep(1);
      }
      return;
    }
  }

  const formData = new FormData();
  formData.append('code_registration', document.getElementById('code_registration').value);
  formData.append('date_registration', document.getElementById('date_registration').value);
  formData.append('mode_registration', document.getElementById('mode_registration').value);
  formData.append('level_registration', document.getElementById('level_registration').value);
  // Opcionales: si van vacios el servidor deduce el tipo del historial y usa
  // el ciclo en curso.
  const tipoMatricula = document.getElementById('tipo_matricula')?.value;
  if (tipoMatricula) formData.append('tipo_matricula', tipoMatricula);
  const anioLectivo = document.getElementById('anio_lectivo')?.value;
  if (anioLectivo) formData.append('anio_lectivo', anioLectivo);
  formData.append('id_student', idStudent);
  formData.append('id_tutor', idTutor);
  formData.append('id_group', idGroup);
  formData.append('name_document', document.getElementById('name_document').value);
  formData.append('file', document.getElementById('file').files[0]);

  // El estado de la matrícula lo decide el servidor: toda matrícula nace
  // pendiente y la confirma después una persona distinta a quien la registró.

  apiFetch('/apiRegistration/Registration/PostFullRegistration/', {
    method: 'POST',
    body: formData
  })
    .then(response => {
      if (!response.ok) {
        return response.json().then(errData => {
          throw new Error(errData.error || "Error al procesar la matrícula");
        });
      }
      return response.json();
    })
    .then(data => {
      showToast(data.message || "Matrícula guardada correctamente", "success");
      
      const role = localStorage.getItem('user_role');
      if (role === 'TUTOR') {
        configureEnrollmentView();
      } else {
        form.reset();
        
        // Ocultar badge de documento
        const badge = document.getElementById("document_badge");
        if (badge) badge.style.display = "none";
        
        // Resetear grupo y regenerar el nuevo código correlativo
        document.getElementById("group_select").selectedIndex = 0;
        setTodayDate();
        loadNextRegistrationCode();
        showStep(1); // Volver al primer paso
      }
    })
    .catch(error => {
      console.error(error);
      showToast(error.message || "Error al conectar con el servidor", "error");
    });
}

