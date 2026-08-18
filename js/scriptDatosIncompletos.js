/**
 * scriptDatosIncompletos.js — Estudiantes con la ficha sin completar.
 *
 * Nace de la carga masiva desde los libros de notas: esos estudiantes
 * entraron solo con nombre y grupo, y el resto de la ficha quedo vacio. En
 * vez de frenar la carga hasta tener todo, se cargaron asi y esta pantalla
 * dice a quien le falta que, y deja completarlo sin salir de aqui.
 */

let datos = null;         // respuesta completa del backend
let filtroTexto = '';

document.addEventListener('DOMContentLoaded', function () {
  cargarGrupos();
  cargar();

  document.getElementById('filtro-grupo').addEventListener('change', cargar);
  document.getElementById('filtro-criticidad').addEventListener('change', cargar);
  document.getElementById('filtro-texto').addEventListener('input', function () {
    filtroTexto = this.value;
    render();
  });
  document.getElementById('form-ficha').addEventListener('submit', guardar);

  const logout = document.getElementById('logout-link');
  if (logout) {
    logout.addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.clear();
      window.location.href = 'vistaPrinc.html';
    });
  }
});

function cargarGrupos() {
  apiFetch('/apiGroup/Group/')
    .then(r => r.ok ? r.json() : [])
    .then(grupos => {
      const select = document.getElementById('filtro-grupo');
      (Array.isArray(grupos) ? grupos : []).forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.code_group;
        opt.textContent = `${g.code_group} - ${g.level_group} (${g.section_group})`;
        select.appendChild(opt);
      });
    })
    .catch(err => console.error(err));
}

function cargar() {
  const grupo = document.getElementById('filtro-grupo').value;
  const criticidad = document.getElementById('filtro-criticidad').value;

  const params = new URLSearchParams();
  if (grupo) params.set('group_code', grupo);
  if (criticidad) params.set('criticidad', criticidad);

  document.getElementById('cuerpo').innerHTML =
    '<tr><td colspan="5" style="text-align:center; padding:26px; color:var(--gray-600);">Cargando...</td></tr>';

  apiFetch(`/apiStudent/Student/DatosIncompletos/?${params.toString()}`)
    .then(res => {
      if (res.status === 403) throw new Error('No tiene autorización para ver las fichas de estudiantes.');
      if (!res.ok) throw new Error('No se pudo obtener el listado.');
      return res.json();
    })
    .then(resData => {
      datos = resData.Record || resData;
      render();
    })
    .catch(err => {
      document.getElementById('cuerpo').innerHTML =
        `<tr><td colspan="5" style="text-align:center; padding:26px; color:var(--danger); font-weight:600;">❌ ${escapeHtml(err.message)}</td></tr>`;
      showToast(err.message, 'error');
    });
}

function render() {
  if (!datos) return;

  const completos = datos.total_estudiantes - datos.con_faltantes;
  document.getElementById('chips').innerHTML = [
    `<span class="chip chip--total">👥 Estudiantes: <strong>${datos.total_estudiantes}</strong></span>`,
    `<span class="chip chip--critico">📋 Con datos pendientes: <strong>${datos.con_faltantes}</strong></span>`,
    `<span class="chip chip--ok">✅ Ficha completa: <strong>${completos}</strong></span>`,
  ].join('');

  const resumen = datos.resumen_por_campo || {};
  const cont = document.getElementById('resumen');
  const claves = Object.keys(resumen);
  cont.innerHTML = claves.length
    ? claves.map(campo => `
        <div class="resumen__item">
          <span class="resumen__campo">${escapeHtml(campo)}</span>
          <span class="resumen__cuenta">${resumen[campo]}</span>
        </div>`).join('')
    : '<p style="color:var(--gray-600);">Ningún campo pendiente.</p>';

  const busqueda = filtroTexto.trim().toLowerCase();
  const lista = (datos.estudiantes || []).filter(e =>
    !busqueda
    || (e.nombre || '').toLowerCase().includes(busqueda)
    || (e.code_student || '').toLowerCase().includes(busqueda)
  );

  document.getElementById('titulo-tabla').textContent =
    `Detalle por estudiante (${lista.length})`;

  const cuerpo = document.getElementById('cuerpo');
  if (!lista.length) {
    cuerpo.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding:26px; color:var(--gray-600);">Nada pendiente con este filtro.</td></tr>';
    return;
  }

  cuerpo.innerHTML = lista.map(e => {
    const etiquetas = e.faltantes.map(f => {
      const titulo = f.consecuencia ? ` title="${escapeHtml(f.consecuencia)}"` : '';
      return `<span class="etiqueta etiqueta--${escapeHtml(f.criticidad)}"${titulo}>${escapeHtml(f.etiqueta)}</span>`;
    }).join('');
    return `
      <tr>
        <td><strong>${escapeHtml(e.code_student)}</strong></td>
        <td>${escapeHtml(e.nombre)}</td>
        <td>${e.group_code ? `<span style="background:rgba(93,60,166,0.1); color:var(--primary); padding:3px 8px; border-radius:4px; font-weight:700; font-size:0.8rem;">${escapeHtml(e.group_code)}</span>` : '<span style="color:var(--gray-500);">Sin grupo</span>'}</td>
        <td>${etiquetas}</td>
        <td><button type="button" class="btn-completar" data-id="${e.id}">Completar</button></td>
      </tr>`;
  }).join('');

  cuerpo.querySelectorAll('.btn-completar').forEach(boton => {
    boton.addEventListener('click', () => abrirModal(parseInt(boton.dataset.id, 10)));
  });
}

// ─────────────────────────────────────────────
// Completar la ficha
// ─────────────────────────────────────────────
function abrirModal(idEstudiante) {
  const fila = (datos.estudiantes || []).find(e => e.id === idEstudiante);
  if (!fila) return;

  document.getElementById('modal-nombre').textContent = fila.nombre;
  document.getElementById('modal-sub').textContent =
    `${fila.code_student}${fila.group_code ? ' · ' + fila.group_code : ''}`;
  document.getElementById('f_id').value = fila.id;

  // Se traen los valores actuales para no borrar lo que ya estaba lleno.
  apiFetch(`/apiStudent/Student/SpecificStudent/?code_student=${encodeURIComponent(fila.code_student)}`)
    .then(r => r.ok ? r.json() : {})
    .then(est => {
      const poner = (id, valor) => { document.getElementById(id).value = valor || ''; };
      poner('f_gender', est.gender);
      poner('f_birthday', est.birthday_student);
      poner('f_nationality', est.nationality);
      poner('f_religion', est.religion);
      poner('f_phone', est.phone_student);
      poner('f_email', est.email_student);
      poner('f_weight', est.weight);
      poner('f_height', est.height);
      poner('f_health', est.health_condition);
      poner('f_address', est.address);
      poner('f_siblings', est.siblings_info);
    })
    .catch(err => console.error(err));

  // La matrícula y el tutor no se arreglan desde aquí: viven en otra pantalla.
  const faltaMatricula = fila.faltantes.some(f => f.campo === 'matricula');
  const faltaTutor = fila.faltantes.some(f => f.campo === 'tutor');
  const nota = document.getElementById('nota-matricula');
  if (faltaMatricula) {
    nota.innerHTML = '⚠️ Este estudiante <strong>no tiene matrícula de este ciclo</strong>, ' +
      'así que no aparece en Notas, Asistencia ni Boletín. Eso se resuelve en ' +
      '<a href="registroMatricula.html" style="color:var(--primary); font-weight:600;">Registro de Matrícula</a>, no aquí.';
  } else if (faltaTutor) {
    nota.innerHTML = 'ℹ️ Le falta el tutor responsable, que se asigna en ' +
      '<a href="registroMatricula.html" style="color:var(--primary); font-weight:600;">Registro de Matrícula</a>.';
  } else {
    nota.textContent = '';
  }

  document.getElementById('modalFicha').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modalFicha').style.display = 'none';
}

function guardar(evento) {
  evento.preventDefault();
  const valor = id => document.getElementById(id).value.trim();

  const payload = {
    student_id: parseInt(document.getElementById('f_id').value, 10),
    gender: valor('f_gender'),
    nationality: valor('f_nationality'),
    religion: valor('f_religion'),
    phone_student: valor('f_phone'),
    email_student: valor('f_email'),
    weight: valor('f_weight'),
    height: valor('f_height'),
    health_condition: valor('f_health'),
    address: valor('f_address'),
    siblings_info: valor('f_siblings'),
  };
  // Una fecha vacía rompe el serializer: solo se manda si tiene valor.
  const nacimiento = valor('f_birthday');
  if (nacimiento) payload.birthday_student = nacimiento;

  apiFetch('/apiStudent/Student/UpdateStudent/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(res => {
      if (!res.ok) throw new Error('No se pudo guardar la ficha');
      return res.json();
    })
    .then(() => {
      showToast('✓ Ficha actualizada', 'success');
      cerrarModal();
      cargar();
    })
    .catch(err => showToast(err.message, 'error'));
}
