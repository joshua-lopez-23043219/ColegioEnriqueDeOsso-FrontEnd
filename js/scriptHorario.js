/**
 * scriptHorario.js — Schedule registration and table view logic
 * Connected to Django SQL Server backend APIs with defensive programming & shift logic
 */

const getBackendUrl = () => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `http://${window.location.hostname}:8000`;
  }
  return API_BASE_URL;
};

const BASE_URL = getBackendUrl();
const TEACHER_API = `${BASE_URL}/apiTeacher/Teacher/`;
const GROUP_API = `${BASE_URL}/apiGroup/Group/`;
const SUBJECT_API = `${BASE_URL}/apiSubjects/Subjects/`;
const IMPARTE_API = `${BASE_URL}/apiImparte/Imparte/`;

let allTeachers = [];
let allGroups = [];
let allSubjects = [];
let allSchedules = [];
let currentEditingId = null;
let activeGeneralShift = "Matutino";
let isReadOnly = false;

// Symmetrical shift periods (6 classes of 45 mins + 30-min recess = 5 hours total)
const shifts = {
  Matutino: [
    { start: "07:00:00", end: "07:45:00", label: "07:00 - 07:45" },
    { start: "07:45:00", end: "08:30:00", label: "07:45 - 08:30" },
    { start: "08:30:00", end: "09:15:00", label: "08:30 - 09:15" },
    { start: "09:15:00", end: "10:00:00", label: "09:15 - 10:00" },
    { start: "10:00:00", end: "10:30:00", label: "10:00 - 10:30", isRecess: true },
    { start: "10:30:00", end: "11:15:00", label: "10:30 - 11:15" },
    { start: "11:15:00", end: "12:00:00", label: "11:15 - 12:00" }
  ],
  Vespertino: [
    { start: "12:30:00", end: "13:15:00", label: "12:30 - 01:15" },
    { start: "13:15:00", end: "14:00:00", label: "01:15 - 02:00" },
    { start: "14:00:00", end: "14:45:00", label: "02:00 - 02:45" },
    { start: "14:45:00", end: "15:30:00", label: "02:45 - 03:30" },
    { start: "15:30:00", end: "16:00:00", label: "03:30 - 04:00", isRecess: true },
    { start: "16:00:00", end: "16:45:00", label: "04:00 - 04:45" },
    { start: "16:45:00", end: "17:30:00", label: "04:45 - 05:30" }
  ]
};

// Safe Toast notification fallback to prevent crashes if global.js fails to load
function safeShowToast(message, type = "info") {
  if (typeof showToast === "function") {
    showToast(message, type);
  } else {
    console.log(`[Toast Fallback] [${type.toUpperCase()}]: ${message}`);
  }
}

// Initializer function
function init() {
  const role = localStorage.getItem("user_role");
  isReadOnly = (role === "ADMINISTRACION");

  if (isReadOnly) {
    // Hide assignment-only fields
    const docenteSelect = document.getElementById("docente");
    if (docenteSelect) {
      const formGroup = docenteSelect.closest(".form__group");
      if (formGroup) formGroup.style.display = "none";
    }

    const asignaturaSelect = document.getElementById("asignatura");
    if (asignaturaSelect) {
      const formGroup = asignaturaSelect.closest(".form__group");
      if (formGroup) formGroup.style.display = "none";
    }

    const horaSelect = document.getElementById("hora");
    if (horaSelect) {
      const formGroup = horaSelect.closest(".form__group");
      if (formGroup) formGroup.style.display = "none";
    }

    // Hide actions/buttons inside form section
    const formButtons = document.querySelector("#form-horario-section .form__button");
    if (formButtons) formButtons.style.display = "none";

    // Change title to "Filtros de Búsqueda"
    const sectionTitle = document.querySelector("#form-horario-section .section__title");
    if (sectionTitle) sectionTitle.textContent = "Filtros de Búsqueda";

    // Hide auto generator
    const generatorSection = document.getElementById("generator-horario-section");
    if (generatorSection) generatorSection.style.display = "none";
    
    // Hide actions column header in table
    const thAccion = document.getElementById("th-accion");
    if (thAccion) thAccion.style.display = "none";
  }

  cargarCatalogos();
  
  const anioSelect = document.getElementById("anio");
  if (anioSelect) {
    anioSelect.addEventListener("change", handleGroupChange);
  }
  
  const turnoSelect = document.getElementById("turno");
  if (turnoSelect) {
    turnoSelect.addEventListener("change", handleShiftChange);
  }

  const diaSelect = document.getElementById("dia");
  if (diaSelect) {
    diaSelect.addEventListener("change", handleDayChange);
  }
}

function handleDayChange() {
  const groupId = document.getElementById("anio").value;
  if (groupId) {
    renderScheduleTable(groupId);
  }
  renderGeneralView();
}

// Run safely bypassing DOMContentLoaded race conditions
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Clean encoding issues from SQL Server/IIS (like Ao, SǸptimo)
function cleanTextForDisplay(str) {
  if (!str) return "";
  return str
    .replace(/S[Ǹ\uFFFD]+ptimo/g, "Séptimo")
    .replace(/s[Ǹ\uFFFD]+ptimo/g, "séptimo")
    .replace(/D[Ǹ\uFFFD]+cimo/g, "Décimo")
    .replace(/d[Ǹ\uFFFD]+cimo/g, "décimo")
    .replace(/Und[Ǹ\uFFFD]+cimo/g, "Undécimo")
    .replace(/und[Ǹ\uFFFD]+cimo/g, "undécimo")
    .replace(/Duod[Ǹ\uFFFD]+cimo/g, "Duodécimo")
    .replace(/duod[Ǹ\uFFFD]+cimo/g, "duodécimo")
    .replace(/Ao/g, "Año")
    .replace(/ao/g, "año")
    .replace(/A\uFFFD/g, "Año")
    .replace(/a\uFFFD/g, "año")
    .replace(/\uFFFD/g, "ñ");
}

// Load catalog data from backend
function cargarCatalogos(preserveGroupId = null) {
  Promise.all([
    apiFetch(TEACHER_API),
    apiFetch(GROUP_API),
    apiFetch(SUBJECT_API),
    apiFetch(IMPARTE_API)
  ])
    .then(responses => {
      responses.forEach((res, i) => {
        if (!res.ok) {
          throw new Error(`Error en petición ${i}: ${res.statusText}`);
        }
      });
      return Promise.all(responses.map(res => res.json()));
    })
    .then(([teachers, groups, subjects, schedules]) => {
      allTeachers = teachers;
      allGroups = groups.map(g => ({ ...g, level_group: cleanTextForDisplay(g.level_group) }));
      allSubjects = subjects.map(s => ({ ...s, academic_subject: cleanTextForDisplay(s.academic_subject) }));
      allSchedules = schedules;

      populateGroupsSelect();
      updateFormForSelectedShift();
      
      const select = document.getElementById("anio");
      if (preserveGroupId && select) {
        select.value = preserveGroupId;
        handleGroupChange();
      } else {
        // Reset subject select
        const subSelect = document.getElementById("asignatura");
        if (subSelect) {
          subSelect.innerHTML = '<option value="" disabled selected>Seleccione un grupo primero</option>';
        }
        // Reset table
        const tbody = document.getElementById("cuerpo-tabla-horario");
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="5" class="form__table-campo" style="color: var(--gray-600); font-style: italic; padding: 20px;">Seleccione un grupo para cargar el horario</td></tr>`;
        }
      }
      
      renderGeneralView();
      
      safeShowToast("Catálogos y horarios actualizados", "success");
    })
    .catch(error => {
      console.error("Error al cargar catálogos:", error);
      safeShowToast("Error al conectar con el servidor de la base de datos", "error");
    });
}

// Populate groups select
function populateGroupsSelect() {
  const select = document.getElementById("anio");
  if (!select) return;
  select.innerHTML = '<option value="" disabled selected>Seleccione un grupo</option>';
  
  allGroups.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.dataset.level = g.level_group;
    opt.textContent = `${g.level_group} - Sección ${g.section_group}`;
    select.appendChild(opt);
  });
}

// Update form fields (Docente & Hours) dynamically based on selected Shift
function updateFormForSelectedShift() {
  const shiftVal = document.getElementById("turno").value;
  
  // 1. Populate teachers for this shift
  const docSelect = document.getElementById("docente");
  if (docSelect) {
    docSelect.innerHTML = '<option value="" disabled selected>Seleccione un docente</option>';
    const shiftTeachers = allTeachers.filter(t => t.shift_teacher === shiftVal);
    shiftTeachers.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.name_teacher} (${t.area_teacher})`;
      docSelect.appendChild(opt);
    });
  }

  // 2. Populate hour dropdown options for this shift
  const horaSelect = document.getElementById("hora");
  if (horaSelect) {
    horaSelect.innerHTML = '<option value="" disabled selected>Seleccione una hora</option>';
    const shiftPeriods = shifts[shiftVal];
    shiftPeriods.forEach(p => {
      if (p.isRecess) return; // Recess has no classes, so skip
      const opt = document.createElement("option");
      opt.value = p.start;
      opt.textContent = p.label;
      horaSelect.appendChild(opt);
    });
  }
}

// Handle shift dropdown change
function handleShiftChange() {
  updateFormForSelectedShift();
  const groupId = document.getElementById("anio").value;
  if (groupId) {
    renderScheduleTable(groupId);
  }
}

// Handle group change event
function handleGroupChange() {
  const selectGroup = document.getElementById("anio");
  const groupId = selectGroup.value;
  if (!groupId) return;

  const selectedOpt = selectGroup.options[selectGroup.selectedIndex];
  const level = selectedOpt.dataset.level;

  // Auto-detect and set shift: 1st-6th grade (Primer to Sexto Año) is Matutino, others are Vespertino
  const cleanLevel = (level || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const matutinoLevels = ["primer ano", "segundo ano", "tercer ano", "cuarto ano", "quinto ano", "sexto ano"];
  const isMatutino = matutinoLevels.some(ml => cleanLevel.includes(ml) || ml.includes(cleanLevel));
  
  const shiftSelect = document.getElementById("turno");
  if (shiftSelect) {
    shiftSelect.value = isMatutino ? "Matutino" : "Vespertino";
    updateFormForSelectedShift();
  }

  // Filter subjects based on group level
  filterSubjects(level);

  // Reload schedules and render table
  loadSchedulesAndRender(groupId);
}

// Filter subjects select by academic level with safety guards
function filterSubjects(level) {
  const select = document.getElementById("asignatura");
  if (!select) return;
  select.innerHTML = '<option value="" disabled selected>Seleccione una asignatura</option>';

  if (!level) {
    allSubjects.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.code_subject} - ${s.name_subject}`;
      select.appendChild(opt);
    });
    return;
  }

  // Clean strings for safe comparison
  const cleanLevel = level.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const filtered = allSubjects.filter(s => {
    const sAcademic = s.academic_subject || "";
    const cleanAcademic = sAcademic.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return cleanAcademic === cleanLevel;
  });

  const subjectsToUse = filtered.length > 0 ? filtered : allSubjects;

  subjectsToUse.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.code_subject} - ${s.name_subject}`;
    select.appendChild(opt);
  });
}

// Fetch latest schedules and render table
function loadSchedulesAndRender(groupId) {
  apiFetch(IMPARTE_API)
    .then(res => {
      if (!res.ok) throw new Error("Error al obtener horarios");
      return res.json();
    })
    .then(schedules => {
      allSchedules = schedules;
      renderScheduleTable(groupId);
      renderGeneralView();
    })
    .catch(err => {
      console.error(err);
      safeShowToast("Error al actualizar la tabla de horarios", "error");
      renderScheduleTable(groupId);
      renderGeneralView();
    });
}

// Render schedule in tabular view for the selected Shift
function renderScheduleTable(groupId) {
  const tbody = document.getElementById("cuerpo-tabla-horario");
  if (!tbody) return;
  tbody.innerHTML = "";

  const shiftVal = document.getElementById("turno").value;
  const currentPeriods = shifts[shiftVal];
  const diaVal = document.getElementById("dia").value;
  const groupSchedules = allSchedules.filter(s => s.id_group == groupId && s.Dia === diaVal);

  currentPeriods.forEach(p => {
    if (p.isRecess) {
      const tr = document.createElement("tr");
      tr.style.background = "rgba(243, 190, 16, 0.12)";
      tr.style.fontWeight = "600";
      tr.innerHTML = `
        <td class="form__table-campo" style="color: var(--primary-dark); font-weight: bold; font-size: 0.9rem;">${p.label}</td>
        <td colspan="4" class="form__table-campo" style="color: var(--primary-dark); font-weight: bold; text-align: center; font-size: 0.9rem; letter-spacing: 0.5px;">
          🥪 RECREO (Receso Estudiantil de 30 min)
        </td>
      `;
      tbody.appendChild(tr);
      return;
    }

    // Find assignment for this hour slot
    const assignment = groupSchedules.find(s => {
      if (!s.Hora) return false;
      return s.Hora.substring(0, 5) === p.start.substring(0, 5);
    });

    const tr = document.createElement("tr");
    tr.className = "form__table-fila";

    if (assignment) {
      tr.innerHTML = `
        <td class="form__table-campo" style="font-weight: 500;">${escapeHtml(p.label)}</td>
        <td class="form__table-campo" style="font-weight: 600; color: var(--primary);">${escapeHtml(assignment.subject_code || "-")}</td>
        <td class="form__table-campo" style="text-align: left; padding-left: 12px;">${escapeHtml(assignment.subject_name || "Asignatura")}</td>
        <td class="form__table-campo" style="text-align: left; padding-left: 12px; color: var(--gray-700);">${escapeHtml(assignment.teacher_name || "Docente")}</td>
        ${isReadOnly ? "" : `
        <td class="form__table-campo">
          <button type="button" class="form__button--purple" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; margin: 0;" onclick="seleccionarHorario(${assignment.id})">
            Editar
          </button>
        </td>`}
      `;
    } else {
      tr.innerHTML = `
        <td class="form__table-campo" style="color: var(--gray-500);">${p.label}</td>
        <td class="form__table-campo" style="color: var(--gray-400); font-style: italic;">-</td>
        <td class="form__table-campo" style="color: var(--gray-400); font-style: italic; text-align: left; padding-left: 12px;">Libre</td>
        <td class="form__table-campo" style="color: var(--gray-400); font-style: italic; text-align: left; padding-left: 12px;">-</td>
        ${isReadOnly ? "" : `
        <td class="form__table-campo">
          <button type="button" class="form__button--green" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; margin: 0;" onclick="programarSlot('${p.start}')">
            Asignar
          </button>
        </td>`}
      `;
    }
    tbody.appendChild(tr);
  });
}

// Detect Shift from raw time string
function detectShiftForTime(timeStr) {
  const cleanTime = timeStr.substring(0, 5);
  const inMatutino = shifts.Matutino.some(p => p.start.substring(0, 5) === cleanTime);
  if (inMatutino) return "Matutino";
  const inVespertino = shifts.Vespertino.some(p => p.start.substring(0, 5) === cleanTime);
  if (inVespertino) return "Vespertino";
  return "Matutino";
}

// Select a row from schedule table to load in form
function seleccionarHorario(id) {
  const sched = allSchedules.find(s => s.id == id);
  if (!sched) return;

  currentEditingId = id;
  document.getElementById("id_horario").value = id;
  
  // Set shift based on assignment hour
  const detectedShift = detectShiftForTime(sched.Hora);
  document.getElementById("turno").value = detectedShift;
  updateFormForSelectedShift(); // update teachers and hours list

  document.getElementById("docente").value = sched.id_teacher;
  document.getElementById("anio").value = sched.id_group;
  
  const group = allGroups.find(g => g.id == sched.id_group);
  if (group) {
    filterSubjects(group.level_group);
  }
  
  document.getElementById("asignatura").value = sched.id_subject;
  
  let rawTime = sched.Hora;
  if (rawTime && rawTime.split(":").length === 2) {
    rawTime = rawTime + ":00";
  }
  document.getElementById("hora").value = rawTime;

  if (sched.Dia) {
    document.getElementById("dia").value = sched.Dia;
  }

  safeShowToast("Clase seleccionada. Puede modificarla o eliminarla.", "info");
}

// Click program slot button to pre-fill the time field
function programarSlot(timeStr) {
  let rawTime = timeStr;
  if (rawTime.split(":").length === 2) {
    rawTime = rawTime + ":00";
  }
  document.getElementById("hora").value = rawTime;
  
  document.getElementById("id_horario").value = "";
  currentEditingId = null;
  document.getElementById("docente").value = "";
  document.getElementById("asignatura").value = "";

  safeShowToast(`Hora seleccionada: ${timeStr.substring(0, 5)}. Complete el resto de campos.`, "info");
}

// Save or route to Update
function guardarhorario(event) {
  if (event) event.preventDefault();

  if (isReadOnly) {
    safeShowToast("⚠️ Acceso denegado: Su rol no tiene permisos para crear o modificar horarios.", "warning");
    return;
  }

  const idHorario = document.getElementById("id_horario").value;
  if (idHorario) {
    editarhorario(event);
    return;
  }

  const docente = document.getElementById("docente").value;
  const group = document.getElementById("anio").value;
  const asignatura = document.getElementById("asignatura").value;
  const hora = document.getElementById("hora").value;
  const dia = document.getElementById("dia").value;

  if (!docente || !group || !asignatura || !hora || !dia) {
    safeShowToast("Por favor, complete todos los campos", "warning");
    return;
  }

  // Validation: check teacher conflict on the same day and hour
  const teacherConflict = allSchedules.find(s => {
    return s.id_teacher == docente && s.Dia === dia && s.Hora.substring(0, 5) === hora.substring(0, 5);
  });
  if (teacherConflict) {
    safeShowToast(`⚠️ Conflicto: El docente ya imparte clase el día ${dia} a esta hora en el grupo "${teacherConflict.group_code}"`, "warning");
    return;
  }

  // Validation: check group conflict on the same day and hour
  const groupConflict = allSchedules.find(s => {
    return s.id_group == group && s.Dia === dia && s.Hora.substring(0, 5) === hora.substring(0, 5);
  });
  if (groupConflict) {
    safeShowToast(`⚠️ Conflicto: Este grupo ya tiene la asignatura "${groupConflict.subject_name}" el día ${dia} a esta hora`, "warning");
    return;
  }

  apiFetch(`${IMPARTE_API}PostImparte/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id_teacher: parseInt(docente),
      id_group: parseInt(group),
      id_subject: parseInt(asignatura),
      Hora: hora,
      Dia: dia
    })
  })
    .then(res => {
      if (!res.ok) throw new Error("Error al guardar el horario");
      return res.json();
    })
    .then(data => {
      safeShowToast("✅ Horario guardado correctamente", "success");
      limpiarFormulario();
      loadSchedulesAndRender(group);
    })
    .catch(err => {
      console.error(err);
      safeShowToast("❌ No se pudo guardar el horario", "error");
    });
}

// Edit schedule
function editarhorario(event) {
  if (event) event.preventDefault();

  if (isReadOnly) {
    safeShowToast("⚠️ Acceso denegado: Su rol no tiene permisos para crear o modificar horarios.", "warning");
    return;
  }

  const idHorario = document.getElementById("id_horario").value;
  if (!idHorario) {
    safeShowToast("Seleccione una clase asignada de la tabla para editar", "warning");
    return;
  }

  const docente = document.getElementById("docente").value;
  const group = document.getElementById("anio").value;
  const asignatura = document.getElementById("asignatura").value;
  const hora = document.getElementById("hora").value;
  const dia = document.getElementById("dia").value;

  if (!docente || !group || !asignatura || !hora || !dia) {
    safeShowToast("Por favor, complete todos los campos", "warning");
    return;
  }

  // Validation: check teacher conflict excluding current record
  const teacherConflict = allSchedules.find(s => {
    return s.id != idHorario && s.id_teacher == docente && s.Dia === dia && s.Hora.substring(0, 5) === hora.substring(0, 5);
  });
  if (teacherConflict) {
    safeShowToast(`⚠️ Conflicto: El docente ya imparte clase el día ${dia} a esta hora en el grupo "${teacherConflict.group_code}"`, "warning");
    return;
  }

  // Validation: check group conflict excluding current record
  const groupConflict = allSchedules.find(s => {
    return s.id != idHorario && s.id_group == group && s.Dia === dia && s.Hora.substring(0, 5) === hora.substring(0, 5);
  });
  if (groupConflict) {
    safeShowToast(`⚠️ Conflicto: Este grupo ya tiene la asignatura "${groupConflict.subject_name}" el día ${dia} a esta hora`, "warning");
    return;
  }

  apiFetch(`${IMPARTE_API}UpdateImparte/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: parseInt(idHorario),
      id_teacher: parseInt(docente),
      id_group: parseInt(group),
      id_subject: parseInt(asignatura),
      Hora: hora,
      Dia: dia
    })
  })
    .then(res => {
      if (!res.ok) throw new Error("Error al actualizar el horario");
      return res.json();
    })
    .then(data => {
      safeShowToast("✅ Horario actualizado correctamente", "success");
      limpiarFormulario();
      loadSchedulesAndRender(group);
    })
    .catch(err => {
      console.error(err);
      safeShowToast("❌ No se pudo actualizar el horario", "error");
    });
}

// Delete schedule
function eliminarhorario(event) {
  if (event) event.preventDefault();

  if (isReadOnly) {
    safeShowToast("⚠️ Acceso denegado: Su rol no tiene permisos para crear o modificar horarios.", "warning");
    return;
  }

  const idHorario = document.getElementById("id_horario").value;
  const group = document.getElementById("anio").value;

  if (!idHorario) {
    safeShowToast("Seleccione una clase asignada de la tabla para eliminar", "warning");
    return;
  }

  if (!confirm("¿Está seguro de que desea eliminar esta asignación de horario?")) {
    return;
  }

  apiFetch(`${IMPARTE_API}DeleteImparte/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: parseInt(idHorario)
    })
  })
    .then(res => {
      if (!res.ok) throw new Error("Error al eliminar el horario");
      return res.text();
    })
    .then(data => {
      safeShowToast("🗑️ Horario eliminado correctamente", "success");
      limpiarFormulario();
      if (group) {
        loadSchedulesAndRender(group);
      }
    })
    .catch(err => {
      console.error(err);
      safeShowToast("❌ No se pudo eliminar el horario", "error");
    });
}

// Clear form fields
function limpiarFormulario() {
  document.getElementById("id_horario").value = "";
  currentEditingId = null;
  document.getElementById("docente").value = "";
  document.getElementById("asignatura").value = "";
  document.getElementById("hora").value = "";
}

// Render the general schedules overview grid
function renderGeneralView() {
  const grid = document.getElementById("vista-general-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const diaVal = document.getElementById("dia").value;
  const dayLabel = document.getElementById("general-view-day-label");
  if (dayLabel) {
    dayLabel.textContent = diaVal;
  }

  // Filter groups according to the search query (all groups are shown in both shifts)
  const searchInput = document.getElementById("search-general");
  const query = searchInput ? searchInput.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

  const filteredGroups = allGroups.filter(g => {
    // Search query filter
    if (query) {
      const gName = `${g.level_group} ${g.section_group}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return gName.includes(query);
    }
    
    return true;
  });

  // Sort groups by academic level order and then section
  const levelOrder = ["primer ano", "segundo ano", "tercer ano", "cuarto ano", "quinto ano", "sexto ano", 
                       "septimo ano", "octavo ano", "noveno ano", "decimo ano", "undecimo ano", "duodecimo ano"];
  
  filteredGroups.sort((a, b) => {
    const cleanA = a.level_group.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const cleanB = b.level_group.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const indexA = levelOrder.indexOf(cleanA);
    const indexB = levelOrder.indexOf(cleanB);
    if (indexA !== indexB) return indexA - indexB;
    return a.section_group.localeCompare(b.section_group);
  });

  if (filteredGroups.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--gray-500); font-style: italic; padding: 20px;">
        No se encontraron grupos para mostrar.
      </div>
    `;
    return;
  }

  filteredGroups.forEach(group => {
    const card = document.createElement("div");
    card.style.background = "var(--white)";
    card.style.borderRadius = "var(--radius-md)";
    card.style.border = "1px solid var(--gray-200)";
    card.style.boxShadow = "var(--shadow-sm)";
    card.style.padding = "14px";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "8px";

    card.innerHTML = `
      <div style="font-weight: 700; color: var(--primary-dark); font-family: var(--font-heading); border-bottom: 2px solid var(--accent); padding-bottom: 5px; font-size: 0.85rem;">
        ${group.level_group} — ${group.section_group}
      </div>
    `;

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    
    const groupSchedules = allSchedules.filter(s => s.id_group == group.id && s.Dia === diaVal);
    const currentPeriods = shifts[activeGeneralShift];

    let rowsHtml = "";
    currentPeriods.forEach(p => {
      if (p.isRecess) {
        rowsHtml += `
          <tr style="background: rgba(243, 190, 16, 0.08); font-size: 0.7rem; font-weight: bold;">
            <td style="padding: 3px; border: 1px solid var(--gray-100); text-align: center; color: var(--primary);">${p.label.split(" - ")[0]}</td>
            <td colspan="2" style="padding: 3px; border: 1px solid var(--gray-100); text-align: center; color: var(--primary-dark);">🥪 RECREO</td>
          </tr>
        `;
        return;
      }

      const assign = groupSchedules.find(s => {
        if (!s.Hora) return false;
        return s.Hora.substring(0, 5) === p.start.substring(0, 5);
      });

      if (assign) {
        const teachInitials = assign.teacher_name.split(" ").slice(0, 2).join(" ");
        rowsHtml += `
          <tr style="font-size: 0.7rem;">
            <td style="padding: 4px; border: 1px solid var(--gray-100); text-align: center; font-weight: 500; color: var(--gray-500);">${p.label.split(" - ")[0]}</td>
            <td style="padding: 4px; border: 1px solid var(--gray-100); font-weight: 600; color: var(--primary);">${assign.subject_code.split("-")[0]}</td>
            <td style="padding: 4px; border: 1px solid var(--gray-100); color: var(--gray-700); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;" title="${assign.teacher_name}">
              ${teachInitials}
            </td>
          </tr>
        `;
      } else {
        rowsHtml += `
          <tr style="font-size: 0.7rem; color: var(--gray-400); font-style: italic;">
            <td style="padding: 4px; border: 1px solid var(--gray-100); text-align: center;">${p.label.split(" - ")[0]}</td>
            <td colspan="2" style="padding: 4px; border: 1px solid var(--gray-100); text-align: center;">-</td>
          </tr>
        `;
      }
    });

    table.innerHTML = `
      <thead>
        <tr style="background: var(--gray-50); font-size: 0.65rem; color: var(--gray-600); font-weight: bold;">
          <th style="padding: 3px; border: 1px solid var(--gray-200);">Hora</th>
          <th style="padding: 3px; border: 1px solid var(--gray-200);">Clase</th>
          <th style="padding: 3px; border: 1px solid var(--gray-200);">Maestro</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    `;
    
    card.appendChild(table);
    grid.appendChild(card);
  });
}

// Switch between shifts in general view
window.switchGeneralTab = function(shift) {
  activeGeneralShift = shift;
  
  const btnMatutino = document.getElementById("btn-tab-matutino");
  const btnVespertino = document.getElementById("btn-tab-vespertino");
  
  if (shift === "Matutino") {
    btnMatutino.classList.add("active");
    btnVespertino.classList.remove("active");
  } else {
    btnVespertino.classList.add("active");
    btnMatutino.classList.remove("active");
  }
  
  renderGeneralView();
};

// Handle independent search input keyups/inputs
window.filterGeneralView = function() {
  renderGeneralView();
};

// Calls the backend endpoint to automatically populate schedules based on chosen template mode
window.generateTemplateSchedule = function() {
  if (isReadOnly) {
    safeShowToast("⚠️ Acceso denegado: Su rol no tiene permisos para crear o modificar horarios.", "warning");
    return;
  }

  const selectEl = document.getElementById("template-select");
  const templateVal = selectEl.value;
  const templateName = selectEl.options[selectEl.selectedIndex].text;
  
  if (!confirm(`⚠️ ADENCIÓN: Esta acción eliminará TODOS los horarios actuales en la base de datos y generará una nueva distribución rotativa libre de choques bajo la plantilla "${templateName}".\n\n¿Desea continuar?`)) {
    return;
  }
  
  safeShowToast("Generando horario rotativo, por favor espere...", "info");
  
  apiFetch(`${IMPARTE_API}GenerateTemplateSchedules/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template: templateVal
    })
  })
    .then(res => {
      if (!res.ok) throw new Error("Error en el servidor al generar horarios");
      return res.json();
    })
    .then(data => {
      safeShowToast(`⚡ ${data.Message}`, "success");
      // Reload catalogs preserving selected group if any
      const currentGroupId = document.getElementById("anio").value;
      cargarCatalogos(currentGroupId);
    })
    .catch(err => {
      console.error(err);
      safeShowToast("❌ No se pudo completar la generación del horario automático", "error");
    });
};