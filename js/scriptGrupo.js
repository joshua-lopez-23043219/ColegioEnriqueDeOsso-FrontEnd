/**
 * scriptGrupo.js — Gestión de Grupos, Aulas y Asignación de Maestro Guía
 * Formato Código de Grupo: Grado-Letra-Aula (ej: 7mo-A-F1)
 */

let allTeachers = [];
let allGroups = [];

document.addEventListener('DOMContentLoaded', () => {
  loadTeachers();
  loadGroups();
});

// Auto-generar el Código de Grupo con formato Grado-Letra-Aula
function updateGroupCode() {
  const level = document.getElementById('level_group').value.trim();
  const section = document.getElementById('section_group').value.trim();
  let classroom = document.getElementById('classroom').value.trim().toUpperCase();

  if (level && section && classroom) {
    document.getElementById('code_group').value = `${level}-${section}-${classroom}`;
  } else if (level && section) {
    document.getElementById('code_group').value = `${level}-${section}`;
  }
}

// Cargar la lista de docentes para el selector de Maestro Guía
function loadTeachers() {
  apiFetch('/apiTeacher/Teacher/')
    .then(res => res.json())
    .then(data => {
      const select = document.getElementById('guide_teacher');
      allTeachers = Array.isArray(data) ? data : (data.results || []);
      
      select.innerHTML = '<option value="">-- Seleccionar Maestro Guía --</option>';
      allTeachers.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        option.textContent = `${t.name_teacher} (${t.code_teacher || 'Docente'})`;
        select.appendChild(option);
      });
    })
    .catch(err => {
      console.error('Error al cargar docentes:', err);
      showToast('Error al cargar la lista de docentes', 'error');
    });
}

// Cargar y mostrar la tabla de grupos registrados
function loadGroups() {
  apiFetch('/apiGroup/Group/')
    .then(res => res.json())
    .then(data => {
      allGroups = Array.isArray(data) ? data : (data.results || []);
      renderGroupsTable();
    })
    .catch(err => {
      console.error('Error al cargar grupos:', err);
    });
}

function renderGroupsTable() {
  const tbody = document.getElementById('groups-tbody');
  if (!allGroups.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--slate-500); padding: 1.5rem;">No hay grupos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = allGroups.map(g => {
    const guideName = g.guide_teacher_name || 'Sin Maestro Guía';
    const guideBadge = g.guide_teacher_name ? `<span class="badge-guide"><i class="ri-user-star-fill"></i> ${guideName}</span>` : '<span style="color:var(--slate-400);">Sin Asignar</span>';

    return `
      <tr>
        <td><strong>${g.code_group}</strong></td>
        <td>${g.level_group} ${g.section_group}</td>
        <td>${g.classroom || 'N/A'}</td>
        <td>${guideBadge}</td>
        <td>${g.amount_group} Alumnos</td>
        <td style="display:flex; gap:6px;">
          <button type="button" style="padding: 4px 8px; background: #FEF3C7; color: #92400E; border: none; border-radius: 6px; cursor: pointer; font-weight:600;" onclick="cargarFormularioEdicion(${g.id})">
            <i class="ri-edit-line"></i> Editar
          </button>
          <button type="button" style="padding: 4px 8px; background: #FEE2E2; color: #991B1B; border: none; border-radius: 6px; cursor: pointer; font-weight:600;" onclick="eliminarGrupo(${g.id})">
            <i class="ri-delete-bin-line"></i> Eliminar
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Guardar o Actualizar Grupo
function guardargrupo(e) {
  if (e) e.preventDefault();

  const editingId = document.getElementById('editing_group_id').value;
  const level = document.getElementById('level_group').value;
  const section = document.getElementById('section_group').value;
  const classroom = document.getElementById('classroom').value.trim().toUpperCase();
  const code = document.getElementById('code_group').value.trim();
  const guideTeacherId = document.getElementById('guide_teacher').value;
  const amount = parseInt(document.getElementById('amount_group').value) || 35;
  const shift = document.getElementById('turno').value;

  if (!level || !section || !classroom || !code) {
    showToast('Por favor complete el Grado, Sección y Aula para formar el Código de Grupo', 'warning');
    return;
  }

  const payload = {
    code_group: code,
    level_group: level,
    section_group: section,
    classroom: classroom,
    amount_group: amount,
    shift_group: shift,
    guide_teacher: guideTeacherId ? parseInt(guideTeacherId) : null
  };

  const url = editingId ? `/apiGroup/Group/${editingId}/UpdateGroup/` : '/apiGroup/Group/PostGroup/';
  const method = editingId ? 'PUT' : 'POST';

  apiFetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(async (res) => {
    const data = await res.json();
    if (!res.ok) {
      let errStr = data.error ? (typeof data.error === 'object' ? JSON.stringify(data.error) : data.error) : 'Error al procesar';
      throw new Error(errStr);
    }
    showToast(data.message || (editingId ? '✅ Grupo actualizado correctamente' : '✅ Grupo creado correctamente'), 'success');
    cancelarEdicion();
    loadGroups();
  })
  .catch(err => {
    showToast('❌ ' + err.message, 'error');
  });
}

function cargarFormularioEdicion(id) {
  const g = allGroups.find(x => x.id === id);
  if (!g) return;

  document.getElementById('editing_group_id').value = g.id;
  document.getElementById('level_group').value = g.level_group || '';
  document.getElementById('section_group').value = g.section_group || '';
  document.getElementById('classroom').value = g.classroom || '';
  document.getElementById('code_group').value = g.code_group || '';
  document.getElementById('amount_group').value = g.amount_group || '35';
  document.getElementById('turno').value = g.shift_group || 'Matutino';
  document.getElementById('guide_teacher').value = g.guide_teacher || '';

  showToast(`Editando grupo ${g.code_group}`, 'info');
}

function cancelarEdicion() {
  document.getElementById('editing_group_id').value = '';
  document.getElementById('form-validation').reset();
}

function eliminarGrupo(id) {
  const g = allGroups.find(x => x.id === id);
  if (!g) return;

  if (!confirm(`¿Está seguro de que desea eliminar el grupo "${g.code_group}"?`)) return;

  apiFetch('/apiGroup/Group/DeleteGroup/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id })
  })
  .then(res => res.json())
  .then(data => {
    showToast(data.message || 'Grupo eliminado', 'info');
    loadGroups();
  })
  .catch(err => {
    showToast('Error al eliminar grupo', 'error');
  });
}