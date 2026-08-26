/**
 * scriptMatricula.js — Matricula de una familia que viene de fuera del centro.
 *
 * QUE CAMBIO Y POR QUE
 * Esta pantalla exigia un `Codigo Estudiante` que YA existiera en la base, asi
 * que para alguien de fuera no servia: habia que pasar antes por Registro de
 * Estudiante y Registro de Tutor. Tres pantallas para un tramite, y si alguien
 * se interrumpia a mitad quedaban fichas sueltas sin matricula.
 *
 * Ahora los campos se escriben aqui y el servidor crea ficha, tutor y
 * matricula en UNA transaccion (`PostMatriculaCompleta`): o queda todo, o no
 * queda nada.
 *
 * LOS BUSCADORES SIGUEN, PERO COMO ATAJO
 * Si el estudiante o el tutor ya estan en el sistema, se traen con Enter y se
 * reutiliza su ficha en vez de duplicarla. Un tutor con dos hijos en el
 * colegio es lo normal.
 *
 * DOS CAMINOS AL GUARDAR
 *   personal   -> PostMatriculaCompleta, que puede crear la ficha.
 *   tutor      -> PostFullRegistration, el de siempre. Ese valida la ventana
 *                 de matricula en linea y que el estudiante sea el suyo, y un
 *                 tutor NO puede crear fichas nuevas.
 */

// Navegación por pasos (Bloques)
function showStep(stepNum) {
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  const targetStep = document.getElementById(`step_${stepNum}`);
  const targetTab = document.getElementById(`tab_btn_${stepNum}`);
  if (targetStep) targetStep.classList.add('active');
  if (targetTab) targetTab.classList.add('active');
}

// Modal Documentos
function AbrirModalDocumentos() {
  document.getElementById("modalDocumentos").style.display = "flex";
}

function CerrarModalDocumentos() {
  document.getElementById("modalDocumentos").style.display = "none";
}

window.addEventListener("click", function (event) {
  const modal = document.getElementById("modalDocumentos");
  if (event.target == modal) CerrarModalDocumentos();
});

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

// Generar código correlativo de matrícula MAT-0000
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

  const campoCiclo = document.getElementById("anio_lectivo");
  if (campoCiclo && !campoCiclo.value) campoCiclo.value = d.getFullYear();
}

function _fijar(id, valor) {
  const campo = document.getElementById(id);
  if (campo) campo.value = valor || '';
}

function _valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value.trim() : '';
}

// ---------------------------------------------------------------- atajos ---
// Buscar estudiante por código (Enter). Es OPCIONAL: sirve para no duplicar
// la ficha de alguien que ya está en el sistema.
document.getElementById("code_student").addEventListener("keydown", function (event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const code = this.value.trim();

  if (!code) {
    showToast("Deje el código vacío para que el sistema lo genere, o escriba uno para buscar", "info");
    return;
  }

  apiFetch(`/apiStudent/Student/SpecificStudent/?code_student=${encodeURIComponent(code)}`)
    .then(response => {
      if (!response.ok) throw new Error("No hay ningún estudiante con ese código: se creará uno nuevo");
      return response.json();
    })
    .then(dataST => {
      _fijar('code_student', dataST.code_student);
      _fijar('name_student', dataST.name_student);
      _fijar('surname_student', dataST.surname_student);
      _fijar('birthday_student', dataST.birthday_student);
      _fijar('phone_student', dataST.phone_student);
      _fijar('email_student', dataST.email_student);
      _fijar('gender_student', dataST.gender);
      _fijar('nationality_student', dataST.nationality);
      _fijar('religion_student', dataST.religion);
      _fijar('health_student', dataST.health_condition);
      _fijar('address_student', dataST.address);
      _fijar('siblings_student', dataST.siblings_info);
      document.getElementById("id_student").value = dataST.id;
      showToast("Estudiante encontrado: se usará su ficha, no se creará otra", "success");
    })
    .catch(error => {
      // No se limpian los campos: lo que la persona ya escribió es válido y
      // borrárselo por no encontrar el código sería perder su trabajo.
      document.getElementById("id_student").value = '';
      showToast(error.message, "info");
    });
});

// Si editan el nombre después de haber traído una ficha, deja de ser esa
// ficha. Sin esto se guardaría la matrícula contra el estudiante equivocado.
['name_student', 'surname_student'].forEach(id => {
  const campo = document.getElementById(id);
  if (campo) campo.addEventListener('input', function () {
    const oculto = document.getElementById('id_student');
    if (oculto && oculto.value) {
      oculto.value = '';
      showToast("Cambió el nombre: se registrará como una ficha nueva", "info");
    }
  });
});

// Buscar tutor por cédula (Enter). Igual: atajo para reutilizar.
document.getElementById("code_tutor").addEventListener("keydown", function (event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const code = this.value.trim();

  if (!code) {
    showToast("Ingrese la cédula del tutor", "warning");
    return;
  }

  apiFetch(`/apiMentor/Mentor/SpecificMentor/?code_tutor=${encodeURIComponent(code)}`)
    .then(response => {
      if (!response.ok) throw new Error("No hay ningún tutor con esa cédula: se creará uno nuevo");
      return response.json();
    })
    .then(dataTR => {
      _fijar('code_tutor', dataTR.code_tutor);
      _fijar('name_tutor', dataTR.name_tutor);
      _fijar('surname_tutor', dataTR.surname_tutor);
      _fijar('birthdate_tutor', dataTR.birthdate_tutor);
      _fijar('phone_tutor', dataTR.phone_tutor);
      _fijar('email_tutor', dataTR.email_tutor);
      _fijar('address_tutor', dataTR.address_tutor);
      _fijar('document_tutor', dataTR.id_document_number);
      _fijar('nationality_tutor', dataTR.nationality);
      _fijar('religion_tutor', dataTR.religion);
      document.getElementById("id_tutor").value = dataTR.id;
      showToast("Tutor encontrado: se usará su ficha, no se creará otra", "success");
    })
    .catch(error => {
      document.getElementById("id_tutor").value = '';
      showToast(error.message, "info");
    });
});

let allGroups = [];

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

  const levelSelect = document.getElementById('level_registration');
  if (levelSelect) levelSelect.addEventListener('change', populateFilteredGroups);

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

  // Un tutor NO captura fichas: solo rematricula al estudiante que ya es
  // suyo. Se le bloquean los campos y se le trae su propia ficha.
  document.querySelectorAll('#step_2 input, #step_2 select, #step_3 input, #step_3 select')
    .forEach(campo => {
      campo.readOnly = true;
      campo.disabled = campo.tagName === 'SELECT';
      campo.style.backgroundColor = 'var(--gray-100)';
    });

  const studentInput = document.getElementById('code_student');
  const tutorInput = document.getElementById('code_tutor');

  const studentCode = localStorage.getItem('student_code');
  if (!studentCode) {
    showToast('Falta el código de estudiante en la sesión. Consulte a la administración.', 'error');
    return;
  }

  apiFetch(`/apiRegistration/Registration/CheckStudentEnrollment/?code_student=${encodeURIComponent(studentCode)}`)
    .then(res => {
      if (!res.ok) throw new Error('Error al verificar estado de matrícula');
      return res.json();
    })
    .then(data => {
      const banner = document.getElementById('enrollment-status-banner');
      const mainLayout = document.getElementById('matricula-main-layout');

      if (data.enrolled) {
        if (mainLayout) mainLayout.style.display = 'none';
        if (banner) {
          banner.style.display = 'block';
          const reg = data.registration;
          if (reg.status_registration === 'PENDIENTE') {
            banner.innerHTML = `
              <div class="layout__section" style="background: #FFF3CD; border: 1.5px solid #FFEBA8; color: #856404; padding: 24px; border-radius: var(--radius-lg); text-align: center; max-width: 800px; margin: auto;">
                <h2 style="font-family: var(--font-heading); margin-bottom: 12px; font-size: 1.3rem;">⏳ Matrícula en Proceso de Confirmación</h2>
                <p style="font-size: 1rem; font-weight: 500; line-height: 1.5;">Su matrícula se encuentra registrada para el periodo <strong>${escapeHtml(reg.level_registration)}</strong> y a la espera de la confirmación por el departamento de administración.</p>
              </div>`;
          } else {
            banner.innerHTML = `
              <div class="layout__section" style="background: #E8F5E9; border: 1.5px solid #C8E6C9; color: #2E7D32; padding: 24px; border-radius: var(--radius-lg); text-align: center; max-width: 800px; margin: auto;">
                <h2 style="font-family: var(--font-heading); margin-bottom: 12px; font-size: 1.3rem;">✓ Matrícula Completada con Éxito</h2>
                <p style="font-size: 1rem; font-weight: 500; line-height: 1.5; color: #1B5E20;"><strong>¡Ya se ha realizado la matrícula en línea!</strong></p>
              </div>`;
          }
        }
      } else {
        apiFetch('/apiUserCreate/UsuarioCreate/GetEnrollmentWindow/')
          .then(res => {
            if (!res.ok) throw new Error('Error al consultar ventana de matrícula');
            return res.json();
          })
          .then(windowData => {
            if (!windowData.enabled) {
              if (mainLayout) mainLayout.style.display = 'none';
              if (banner) {
                banner.style.display = 'block';
                banner.innerHTML = `
                  <div class="layout__section" style="background: #F8D7DA; border: 1.5px solid #F5C6CB; color: #721C24; padding: 24px; border-radius: var(--radius-lg); text-align: center; max-width: 800px; margin: auto;">
                    <h2 style="font-family: var(--font-heading); margin-bottom: 12px; font-size: 1.3rem;">⚠️ Matrícula Inhabilitada</h2>
                    <p style="font-size: 1rem; font-weight: 500; line-height: 1.5;">La matrícula en línea se encuentra inhabilitada actualmente. Favor consultar con la administración.</p>
                  </div>`;
              }
            } else if (studentInput) {
              studentInput.value = studentCode;
              setTimeout(() => {
                studentInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
              }, 500);

              const tutorId = localStorage.getItem('tutor_id');
              if (tutorId && tutorId !== 'null') {
                apiFetch(`/apiMentor/Mentor/${tutorId}/`)
                  .then(res => res.json())
                  .then(mentorData => {
                    if (tutorInput) {
                      tutorInput.value = mentorData.code_tutor;
                      setTimeout(() => {
                        tutorInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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

// --------------------------------------------------------------- guardar ---
function guardarMatricula(confirmarHomonimo) {
  const role = localStorage.getItem('user_role');
  const esTutor = role === 'TUTOR';

  const idGroup = _valor('id_group');
  if (!idGroup) {
    showToast("Debe seleccionar un grupo en el Paso 4", "warning");
    showStep(4);
    return;
  }
  if (!_valor('mode_registration') || !_valor('level_registration')) {
    showToast("Complete el turno y el año académico en el Paso 1", "warning");
    showStep(1);
    return;
  }

  // El tutor en línea sigue por el endpoint de siempre: ese valida la
  // ventana de matrícula y que el estudiante sea el suyo.
  if (esTutor) return guardarComoTutor(idGroup);

  if (!_valor('name_student') || !_valor('surname_student')) {
    showToast("Escriba el nombre y los apellidos del estudiante (Paso 2)", "warning");
    showStep(2);
    return;
  }
  if (!_valor('code_tutor')) {
    showToast("La cédula del tutor es obligatoria (Paso 3)", "warning");
    showStep(3);
    return;
  }

  const datos = new FormData();
  datos.append('code_registration', _valor('code_registration'));
  datos.append('date_registration', _valor('date_registration'));
  datos.append('mode_registration', _valor('mode_registration'));
  datos.append('level_registration', _valor('level_registration'));
  datos.append('id_group', idGroup);
  if (_valor('anio_lectivo')) datos.append('anio_lectivo', _valor('anio_lectivo'));
  if (_valor('tipo_matricula')) datos.append('tipo_matricula', _valor('tipo_matricula'));

  if (_valor('id_student')) datos.append('id_student', _valor('id_student'));
  datos.append('code_student', _valor('code_student'));
  datos.append('name_student', _valor('name_student'));
  datos.append('surname_student', _valor('surname_student'));
  datos.append('birthday_student', _valor('birthday_student'));
  datos.append('gender', _valor('gender_student'));
  datos.append('nationality', _valor('nationality_student'));
  datos.append('religion', _valor('religion_student'));
  datos.append('health_condition', _valor('health_student'));
  datos.append('address', _valor('address_student'));
  datos.append('siblings_info', _valor('siblings_student'));
  datos.append('phone_student', _valor('phone_student'));
  datos.append('email_student', _valor('email_student'));

  if (_valor('id_tutor')) datos.append('id_tutor', _valor('id_tutor'));
  datos.append('code_tutor', _valor('code_tutor'));
  datos.append('name_tutor', _valor('name_tutor'));
  datos.append('surname_tutor', _valor('surname_tutor'));
  datos.append('birthdate_tutor', _valor('birthdate_tutor'));
  datos.append('phone_tutor', _valor('phone_tutor'));
  datos.append('email_tutor', _valor('email_tutor'));
  datos.append('address_tutor', _valor('address_tutor'));
  datos.append('id_document_number', _valor('document_tutor'));
  datos.append('nationality_tutor', _valor('nationality_tutor'));
  datos.append('religion_tutor', _valor('religion_tutor'));

  const archivo = document.getElementById('file');
  if (archivo && archivo.files.length > 0) {
    datos.append('name_document', _valor('name_document'));
    datos.append('file', archivo.files[0]);
  }

  if (confirmarHomonimo) datos.append('confirmar_homonimo', 'true');

  apiFetch('/apiRegistration/Registration/PostMatriculaCompleta/', {
    method: 'POST', body: datos
  })
    .then(response => response.json().then(cuerpo => ({ status: response.status, cuerpo })))
    .then(({ status, cuerpo }) => {
      // 409: el servidor encontró una ficha con ese mismo nombre y se detuvo
      // antes de crear otra. Decide una persona, no el sistema.
      if (status === 409 && cuerpo.requiere_confirmacion) {
        return avisarHomonimos(cuerpo.homonimos);
      }
      if (status !== 201) throw new Error(cuerpo.error || "Error al procesar la matrícula");

      showToast(cuerpo.message, "success");
      limpiarFormulario();
    })
    .catch(error => {
      console.error(error);
      showToast(error.message || "Error al conectar con el servidor", "error");
    });
}

function avisarHomonimos(homonimos) {
  const lista = (homonimos || [])
    .map(h => `• ${h.nombre} (${h.code_student}${h.grupo ? ', ' + h.grupo : ''})`)
    .join('\n');
  const seguir = window.confirm(
    'Ya hay una ficha con ese nombre en el sistema:\n\n' + lista +
    '\n\nSi es la MISMA persona, cancele y búsquela por su código en el Paso 2 ' +
    '(o use Reingreso si ya estuvo matriculada).\n\n' +
    '¿Es otra persona distinta y quiere crear una ficha nueva?');
  if (seguir) guardarMatricula(true);
}

// El camino del tutor en línea: no crea fichas, solo la matrícula.
function guardarComoTutor(idGroup) {
  const idStudent = _valor('id_student');
  const idTutor = _valor('id_tutor');
  if (!idStudent || !idTutor) {
    showToast("Todavía se están cargando sus datos. Espere un momento.", "warning");
    return;
  }

  const archivo = document.getElementById('file');
  if (!archivo || archivo.files.length === 0) {
    showToast("Debe adjuntar el documento PDF en el Paso 2", "warning");
    showStep(2);
    return;
  }

  const datos = new FormData();
  datos.append('code_registration', _valor('code_registration'));
  datos.append('date_registration', _valor('date_registration'));
  datos.append('mode_registration', _valor('mode_registration'));
  datos.append('level_registration', _valor('level_registration'));
  datos.append('id_student', idStudent);
  datos.append('id_tutor', idTutor);
  datos.append('id_group', idGroup);
  datos.append('name_document', _valor('name_document'));
  datos.append('file', archivo.files[0]);

  apiFetch('/apiRegistration/Registration/PostFullRegistration/', {
    method: 'POST', body: datos
  })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.error || "Error al procesar la matrícula"); });
      }
      return response.json();
    })
    .then(data => {
      showToast(data.message || "Matrícula guardada correctamente", "success");
      configureEnrollmentView();
    })
    .catch(error => showToast(error.message, "error"));
}

function limpiarFormulario() {
  document.getElementById('form_matricula').reset();
  document.getElementById('id_student').value = '';
  document.getElementById('id_tutor').value = '';
  const badge = document.getElementById("document_badge");
  if (badge) badge.style.display = "none";
  const grupo = document.getElementById("group_select");
  if (grupo) grupo.selectedIndex = 0;
  setTodayDate();
  loadNextRegistrationCode();
  showStep(1);
}
