/**
 * listadoTutores.js
 * Carga y gestión completa del catálogo de Tutores del Colegio Enrique de Ossó.
 */

let cachedTutors = [];

document.addEventListener('DOMContentLoaded', function () {
  loadTutors();

  const searchInput = document.getElementById('search-tutor-input');
  if (searchInput) {
    searchInput.addEventListener('input', filterTutors);
  }

  const btnSearch = document.getElementById('btn-search-tutor');
  if (btnSearch) {
    btnSearch.addEventListener('click', filterTutors);
  }

  const editForm = document.getElementById('edit-tutor-form');
  if (editForm) {
    editForm.addEventListener('submit', handleEditTutorSubmit);
  }

  const logoutBtn = document.getElementById('logout-link');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.clear();
      window.location.href = 'vistaPrinc.html';
    });
  }
});

function loadTutors() {
  const tbody = document.getElementById('tutors-tbody');
  const countBadge = document.getElementById('tutor-count-badge');
  const noMessage = document.getElementById('no-tutors-message');
  const tableWrapper = document.getElementById('table-tutors-wrapper');

  if (!tbody) return;

  apiFetch('/apiMentor/Mentor/ListMentor/')
    .then(response => {
      if (!response.ok) throw new Error('Error al obtener la lista de tutores');
      return response.json();
    })
    .then(res => {
      const data = res.Record || res;
      cachedTutors = data;

      if (countBadge) countBadge.textContent = `Total: ${data.length} tutores registrados`;
      renderTutorsTable(data);
    })
    .catch(err => {
      console.error(err);
      if (countBadge) countBadge.textContent = 'Error al cargar tutores';
      showToast('Error al conectar con la base de datos de tutores', 'error');
    });
}

function renderTutorsTable(tutors) {
  const tbody = document.getElementById('tutors-tbody');
  const noMessage = document.getElementById('no-tutors-message');
  const tableWrapper = document.getElementById('table-tutors-wrapper');

  if (!tbody) return;
  tbody.innerHTML = '';

  if (tutors.length === 0) {
    if (noMessage) noMessage.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';
    return;
  }

  if (noMessage) noMessage.style.display = 'none';
  if (tableWrapper) tableWrapper.style.display = 'block';

  tutors.forEach(t => {
    const row = document.createElement('tr');
    row.className = 'form__table-fila';

    // Cédula / Código
    const cellCode = document.createElement('td');
    cellCode.className = 'form__table-campo';
    cellCode.style.fontWeight = '600';
    cellCode.style.color = 'var(--primary-dark)';
    cellCode.textContent = t.code_tutor || 'N/A';
    row.appendChild(cellCode);

    // Tutor / Nombre
    const cellName = document.createElement('td');
    cellName.className = 'form__table-campo';
    cellName.style.textAlign = 'left';
    cellName.style.paddingLeft = '12px';
    const fullName = `${t.name_tutor || ''} ${t.surname_tutor || ''}`.trim() || t.first_lastname || 'Tutor Registrado';
    cellName.textContent = fullName;
    row.appendChild(cellName);

    // Teléfono
    const cellPhone = document.createElement('td');
    cellPhone.className = 'form__table-campo';
    cellPhone.textContent = t.phone_tutor || 'N/A';
    row.appendChild(cellPhone);

    // Email
    const cellEmail = document.createElement('td');
    cellEmail.className = 'form__table-campo';
    cellEmail.style.fontSize = '0.85rem';
    cellEmail.style.color = 'var(--primary)';
    cellEmail.textContent = t.email_tutor || 'N/A';
    row.appendChild(cellEmail);

    // Dirección
    const cellAddress = document.createElement('td');
    cellAddress.className = 'form__table-campo';
    cellAddress.style.textAlign = 'left';
    cellAddress.style.fontSize = '0.85rem';
    cellAddress.textContent = t.address_tutor || 'Managua, Nicaragua';
    row.appendChild(cellAddress);

    // Acciones
    const cellActions = document.createElement('td');
    cellActions.className = 'form__table-campo';
    cellActions.style.textAlign = 'center';
    
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'action-btn';
    editBtn.title = 'Editar Tutor';
    editBtn.style.color = 'var(--primary)';
    editBtn.style.background = 'transparent';
    editBtn.style.border = 'none';
    editBtn.style.cursor = 'pointer';
    editBtn.style.fontSize = '1.1rem';
    editBtn.innerHTML = '✏️';
    editBtn.onclick = () => openEditTutorModal(t);

    cellActions.appendChild(editBtn);
    row.appendChild(cellActions);

    tbody.appendChild(row);
  });
}

function filterTutors() {
  const query = (document.getElementById('search-tutor-input').value || '').toLowerCase().trim();
  if (!query) {
    renderTutorsTable(cachedTutors);
    return;
  }

  const filtered = cachedTutors.filter(t => {
    const code = (t.code_tutor || '').toLowerCase();
    const name = (t.name_tutor || '').toLowerCase();
    const surname = (t.surname_tutor || '').toLowerCase();
    const phone = (t.phone_tutor || '').toLowerCase();

    return code.includes(query) || name.includes(query) || surname.includes(query) || phone.includes(query);
  });

  renderTutorsTable(filtered);
}

function openEditTutorModal(t) {
  document.getElementById('modal_tutor_id').value = t.id || '';
  document.getElementById('modal_code_tutor').value = t.code_tutor || '';
  document.getElementById('modal_name_tutor').value = t.name_tutor || '';
  document.getElementById('modal_surname_tutor').value = t.surname_tutor || '';
  document.getElementById('modal_phone_tutor').value = t.phone_tutor || '';
  document.getElementById('modal_email_tutor').value = t.email_tutor || '';
  document.getElementById('modal_address_tutor').value = t.address_tutor || '';

  const modal = document.getElementById('editTutorModal');
  if (modal) modal.style.display = 'flex';
}

function closeEditTutorModal() {
  const modal = document.getElementById('editTutorModal');
  if (modal) modal.style.display = 'none';
}

function handleEditTutorSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('modal_tutor_id').value;
  const code_tutor = document.getElementById('modal_code_tutor').value.trim();
  const name_tutor = document.getElementById('modal_name_tutor').value.trim();
  const surname_tutor = document.getElementById('modal_surname_tutor').value.trim();
  const phone_tutor = document.getElementById('modal_phone_tutor').value.trim();
  const email_tutor = document.getElementById('modal_email_tutor').value.trim();
  const address_tutor = document.getElementById('modal_address_tutor').value.trim();

  const payload = {
    id: parseInt(id),
    code_tutor,
    name_tutor,
    surname_tutor,
    phone_tutor,
    email_tutor,
    address_tutor
  };

  apiFetch('/apiMentor/Mentor/UpdateMentor/', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al actualizar el tutor');
      return res.json();
    })
    .then(data => {
      showToast('✅ Tutor actualizado con éxito', 'success');
      closeEditTutorModal();
      loadTutors();
    })
    .catch(err => {
      console.error(err);
      showToast(err.message || 'Error al actualizar datos del tutor', 'error');
    });
}
