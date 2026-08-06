/**
 * scriptAsignatura.js — Registro y edición de asignaturas.
 *
 * Incluye el tipo de evaluación: las asignaturas cualitativas se califican con
 * la escala de logro AA/AS/AF/AI en lugar de una nota numérica.
 *
 * Nota: antes esta pantalla solo mostraba un mensaje de confirmación sin
 * guardar nada; ahora consume la API real.
 */

function _datosFormulario() {
  return {
    code_subject: document.getElementById('codasignatura').value.trim(),
    name_subject: document.getElementById('nombre').value,
    academic_subject: document.getElementById('anio').value,
    period_subject: document.getElementById('periodo').value,
    tipo_evaluacion: document.getElementById('tipo_evaluacion').value || 'CUANTITATIVA',
  };
}

function _validar(datos) {
  if (!datos.code_subject || !datos.name_subject ||
      !datos.academic_subject || !datos.period_subject) {
    showToast('Completa todos los campos', 'warning');
    return false;
  }
  return true;
}

function _limpiarFormulario() {
  const form = document.getElementById('form-asign');
  if (form) form.reset();
}

/**
 * Los endpoints de actualizar/eliminar trabajan con el id interno, pero el
 * formulario solo pide el código; se resuelve el id a partir del código.
 */
function _buscarPorCodigo(code) {
  return apiFetch('/apiSubjects/Subjects/ListSubjects/')
    .then(res => {
      if (!res.ok) throw new Error('No se pudo consultar las asignaturas');
      return res.json();
    })
    .then(resp => {
      const lista = resp.Record || resp || [];
      const encontrada = lista.find(
        s => String(s.code_subject).trim().toLowerCase() === code.toLowerCase());
      if (!encontrada) throw new Error(`No existe una asignatura con el código ${code}`);
      return encontrada;
    });
}

function guardarasignatura(event) {
  event.preventDefault();
  const datos = _datosFormulario();
  if (!_validar(datos)) return;

  apiFetch('/apiSubjects/Subjects/PostSubjects/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
    .then(res => res.json().then(body => ({ ok: res.ok, body })))
    .then(({ ok, body }) => {
      if (!ok) throw new Error(body.error || 'No se pudo guardar la asignatura');
      showToast('Asignatura guardada correctamente', 'success');
      _limpiarFormulario();
    })
    .catch(err => showToast(err.message, 'error'));
}

function editarasignatura(event) {
  event.preventDefault();
  const datos = _datosFormulario();
  if (!_validar(datos)) return;

  _buscarPorCodigo(datos.code_subject)
    .then(existente => apiFetch('/apiSubjects/Subjects/UpdateSubjects/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ id: existente.id }, datos)),
    }))
    .then(res => res.json().then(body => ({ ok: res.ok, body })))
    .then(({ ok, body }) => {
      if (!ok) throw new Error(body.error || 'No se pudo actualizar la asignatura');
      showToast('Asignatura actualizada correctamente', 'success');
    })
    .catch(err => showToast(err.message, 'error'));
}

function eliminarasignatura(event) {
  event.preventDefault();
  const code = document.getElementById('codasignatura').value.trim();
  if (!code) {
    showToast('Ingrese el código de la asignatura a eliminar', 'warning');
    return;
  }
  if (!confirm(`¿Eliminar la asignatura ${code}? Esta acción no se puede deshacer.`)) return;

  _buscarPorCodigo(code)
    .then(existente => apiFetch('/apiSubjects/Subjects/DeleteSubjects/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: existente.id }),
    }))
    .then(res => res.json().then(body => ({ ok: res.ok, body })).catch(() => ({ ok: res.ok, body: {} })))
    .then(({ ok, body }) => {
      if (!ok) throw new Error(body.error || 'No se pudo eliminar la asignatura');
      showToast('Asignatura eliminada', 'success');
      _limpiarFormulario();
    })
    .catch(err => showToast(err.message, 'error'));
}
