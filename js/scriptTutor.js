/**
 * scriptTutor.js — Tutor registration with API integration
 * goBack() and dropdown code removed (now in global.js)
 */

// Buscar tutor al presionar Enter
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('code_tutor').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarTutor();
    }
  });
});

function recolectarDatosTutor() {
  return {
    code_tutor: document.getElementById('code_tutor').value.trim(),
    name_tutor: document.getElementById('name_tutor').value.trim(),
    surname_tutor: document.getElementById('surname_tutor').value.trim(),
    birthdate_tutor: document.getElementById('birthdate_tutor').value,
    phone_tutor: document.getElementById('phone_tutor').value.trim(),
    email_tutor: document.getElementById('email_tutor').value.trim(),
    address_tutor: document.getElementById('address_tutor').value.trim()
  };
}

function registrarTutor() {
  const data = recolectarDatosTutor();

  apiFetch('/apiMentor/Mentor/PostMentor/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(res => res.json().then(body => ({ status: res.status, body })))
    .then(({ status, body }) => {
      if (status === 200) {
        showToast("Tutor registrado correctamente", "success");
        document.getElementById('form-validation').reset();
      } else {
        showToast('⚠️ ' + (body.error || 'Error al registrar el tutor'), "info");
      }
    })
    .catch(() => showToast('❌ No se pudo conectar con el servidor'), "info");
}

function editarTutor() {
  const data = recolectarDatosTutor();

  apiFetch('/apiMentor/Mentor/UpdateMentor/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(res => {
      if (res.ok) {
        showToast("Tutor actualizado correctamente", "success");
        document.getElementById('form-validation').reset();
      } else {
        showToast("Error al actualizar el tutor", "error");
      }
    })
    .catch(() => showToast('❌ No se pudo conectar con el servidor'), "info");
}

function buscarTutor() {
  const code = document.getElementById('code_tutor').value.trim();
  if (!code) {
    showToast("Por favor ingresa un código de tutor", "info");
    return;
  }

  apiFetch(`/apiMentor/Mentor/SpecificMentor/?code_tutor=${encodeURIComponent(code)}`)
    .then(res => res.json().then(data => ({ status: res.status, data })))
    .then(({ status, data }) => {
      if (status === 200) {
        document.getElementById('code_tutor').value = data.code_tutor;
        document.getElementById('name_tutor').value = data.name_tutor;
        document.getElementById('surname_tutor').value = data.surname_tutor;
        document.getElementById('birthdate_tutor').value = data.birthdate_tutor;
        document.getElementById('phone_tutor').value = data.phone_tutor;
        document.getElementById('email_tutor').value = data.email_tutor;
        document.getElementById('address_tutor').value = data.address_tutor;
        showToast("Tutor encontrado", "success");
      } else {
        showToast('❌ ' + (data.error || 'Tutor no encontrado'), "info");
      }
    })
    .catch(() => showToast('❌ No se pudo conectar con el servidor'), "info");
}
