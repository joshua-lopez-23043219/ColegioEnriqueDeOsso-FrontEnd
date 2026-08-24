/**
 * scriptValores.js — Captura de Valores y Actitudes por corte.
 *
 * Lo llena el maestro guía de cada grupo. A diferencia de las notas de
 * asignatura, esto NO se calcula: los 7 criterios y el desempeño general son
 * una valoración del acompañamiento y se deciden a mano, igual que hoy se
 * hace en la hoja de Excel del colegio.
 *
 * La pantalla guarda el corte completo de una sola vez, no estudiante por
 * estudiante: el guía llena la tabla de corrido y manda todo junto.
 */

const ESCALA = ['AA', 'AS', 'AF', 'AI'];

let estudiantes = [];      // estado en pantalla
let instantaneaGuardada = '';
let filaObservacion = null;

document.addEventListener('DOMContentLoaded', function () {
  cargarGrupos();
  cargarCriterios();

  document.getElementById('btn-cargar').addEventListener('click', cargarCorte);
  document.getElementById('btn-guardar').addEventListener('click', guardarCorte);
  document.getElementById('btn-aplicar-obs').addEventListener('click', aplicarObservacion);

  const logout = document.getElementById('logout-link');
  if (logout) {
    logout.addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.clear();
      window.location.href = 'vistaPrinc.html';
    });
  }

  // Avisar antes de salir con cambios sin guardar: la tabla es larga y
  // perderla por un clic de más sería muy molesto.
  window.addEventListener('beforeunload', function (e) {
    if (hayCambiosSinGuardar()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
});

function instantanea() {
  return JSON.stringify(estudiantes.map(e => [
    e.id_registration, e.criterios, e.desempeno_general,
    e.observacion, e.reunion_padres, e.horas_ecologicas,
  ]));
}

function hayCambiosSinGuardar() {
  return estudiantes.length > 0 && instantanea() !== instantaneaGuardada;
}

function marcarCambios() {
  document.getElementById('aviso-cambios').style.display =
    hayCambiosSinGuardar() ? 'block' : 'none';
}

function cargarGrupos() {
  apiFetch('/apiGroup/Group/ListaGrupos/')
    .then(res => {
      if (!res.ok) throw new Error('No se pudieron cargar los grupos');
      return res.json();
    })
    .then(datos => {
      const grupos = Array.isArray(datos) ? datos : (datos.Record || []);
      const select = document.getElementById('sel-grupo');
      select.innerHTML = '<option value="" disabled selected>Seleccione un grupo</option>';
      grupos.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = `${g.code_group} - ${g.level_group} (${g.section_group})`;
        select.appendChild(opt);
      });
    })
    .catch(err => {
      console.error(err);
      showToast('No se pudieron cargar los grupos', 'error');
    });
}

// Los 7 criterios se piden al servidor en vez de repetirlos aquí: si el
// colegio los cambia, se cambian en un solo lugar.
function cargarCriterios() {
  apiFetch('/apiNote/Seguimiento/GetCriterios/')
    .then(res => res.ok ? res.json() : Promise.reject(new Error('criterios')))
    .then(datos => {
      const lista = (datos.Record || datos || []);
      const ol = document.getElementById('lista-criterios');
      ol.innerHTML = '';
      lista.forEach(c => {
        const li = document.createElement('li');
        li.textContent = c.texto;
        ol.appendChild(li);
      });
      // El encabezado C1..C7 muestra el texto completo al pasar el mouse.
      document.querySelectorAll('#tabla-valores thead th[title^="Criterio"]').forEach((th, i) => {
        if (lista[i]) th.title = lista[i].texto;
      });
    })
    .catch(() => { /* la tabla funciona igual sin la leyenda */ });
}

function cargarCorte() {
  const idGrupo = document.getElementById('sel-grupo').value;
  const corte = document.getElementById('sel-corte').value;
  if (!idGrupo) {
    showToast('Seleccione un grupo', 'warning');
    return;
  }
  if (hayCambiosSinGuardar() &&
      !confirm('Hay cambios sin guardar en el corte actual. ¿Descartarlos y cargar otro?')) {
    return;
  }

  apiFetch(`/apiNote/Seguimiento/GetSeguimiento/?id_group=${encodeURIComponent(idGrupo)}&corte=${encodeURIComponent(corte)}`)
    .then(res => {
      if (res.status === 403) {
        throw new Error('Solo el maestro guía de este grupo o la dirección pueden llenarlo.');
      }
      if (!res.ok) throw new Error('No se pudo cargar el acompañamiento');
      return res.json();
    })
    .then(datos => {
      const registro = datos.Record || datos;
      estudiantes = registro.estudiantes || [];
      document.getElementById('titulo-tabla').textContent =
        `${registro.code_group} — ${corte} Corte (${estudiantes.length} estudiantes)`;
      document.getElementById('seccion-tabla').style.display = 'block';
      renderTabla();
      instantaneaGuardada = instantanea();
      marcarCambios();
      document.getElementById('estado-guardado').textContent = '';
      if (estudiantes.length === 0) {
        showToast('Este grupo no tiene estudiantes matriculados en el ciclo actual.', 'warning', 7000);
      }
    })
    .catch(err => {
      console.error(err);
      showToast(err.message, 'error', 7000);
    });
}

function selectEscala(valor, alCambiar) {
  const select = document.createElement('select');
  select.className = 'sel-escala';
  const vacia = document.createElement('option');
  vacia.value = '';
  vacia.textContent = '—';
  select.appendChild(vacia);
  ESCALA.forEach(codigo => {
    const opt = document.createElement('option');
    opt.value = codigo;
    opt.textContent = codigo;
    select.appendChild(opt);
  });
  select.value = valor || '';
  select.dataset.valor = valor || '';
  select.addEventListener('change', function () {
    this.dataset.valor = this.value;
    alCambiar(this.value);
    marcarCambios();
  });
  return select;
}

function renderTabla() {
  const cuerpo = document.getElementById('cuerpo-tabla');
  cuerpo.innerHTML = '';

  estudiantes.forEach((alumno, indice) => {
    const fila = document.createElement('tr');

    const celdaNombre = document.createElement('td');
    celdaNombre.className = 'col-alumno';
    celdaNombre.innerHTML = `<strong>${escapeHtml(alumno.name_student)}</strong>` +
      `<br><span style="color:var(--gray-600); font-size:0.76rem;">${escapeHtml(alumno.code_student)}</span>`;
    fila.appendChild(celdaNombre);

    // Los 7 criterios
    for (let i = 0; i < 7; i++) {
      const celda = document.createElement('td');
      celda.appendChild(selectEscala(alumno.criterios[i], valor => {
        estudiantes[indice].criterios[i] = valor;
      }));
      fila.appendChild(celda);
    }

    // Desempeño general (también manual, no se promedia de los criterios)
    const celdaDesempeno = document.createElement('td');
    celdaDesempeno.appendChild(selectEscala(alumno.desempeno_general, valor => {
      estudiantes[indice].desempeno_general = valor;
    }));
    fila.appendChild(celdaDesempeno);

    // Reunión de padres
    const celdaReunion = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = alumno.reunion_padres === true;
    chk.style.width = '18px';
    chk.style.height = '18px';
    chk.addEventListener('change', function () {
      estudiantes[indice].reunion_padres = this.checked;
      marcarCambios();
    });
    celdaReunion.appendChild(chk);
    fila.appendChild(celdaReunion);

    // Horas ecológicas
    const celdaHoras = document.createElement('td');
    const inputHoras = document.createElement('input');
    inputHoras.type = 'number';
    inputHoras.min = '0';
    inputHoras.className = 'input-horas';
    inputHoras.value = alumno.horas_ecologicas || 0;
    inputHoras.addEventListener('input', function () {
      estudiantes[indice].horas_ecologicas = parseInt(this.value || '0', 10);
      marcarCambios();
    });
    celdaHoras.appendChild(inputHoras);
    fila.appendChild(celdaHoras);

    // Observación (en modal: no cabe en la tabla)
    const celdaObs = document.createElement('td');
    const btnObs = document.createElement('button');
    btnObs.type = 'button';
    btnObs.className = 'btn-observacion' + (alumno.observacion ? ' tiene' : '');
    btnObs.textContent = alumno.observacion ? 'Ver / editar' : 'Escribir';
    btnObs.addEventListener('click', () => abrirObservacion(indice));
    celdaObs.appendChild(btnObs);
    fila.appendChild(celdaObs);

    cuerpo.appendChild(fila);
  });
}

// ── Observación ──────────────────────────────────────────
function abrirObservacion(indice) {
  filaObservacion = indice;
  const alumno = estudiantes[indice];
  document.getElementById('obs-alumno').textContent =
    `${alumno.name_student} — ${alumno.code_student}`;
  document.getElementById('obs-texto').value = alumno.observacion || '';
  document.getElementById('modal-observacion').style.display = 'flex';
}

function cerrarObservacion() {
  document.getElementById('modal-observacion').style.display = 'none';
  filaObservacion = null;
}

function aplicarObservacion() {
  if (filaObservacion === null) return;
  estudiantes[filaObservacion].observacion = document.getElementById('obs-texto').value.trim();
  cerrarObservacion();
  renderTabla();
  marcarCambios();
}

// ── Guardado ─────────────────────────────────────────────
function guardarCorte() {
  const idGrupo = document.getElementById('sel-grupo').value;
  const corte = document.getElementById('sel-corte').value;
  if (!idGrupo || estudiantes.length === 0) {
    showToast('No hay nada que guardar', 'warning');
    return;
  }

  const boton = document.getElementById('btn-guardar');
  boton.disabled = true;

  apiFetch('/apiNote/Seguimiento/SaveSeguimiento/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_group: parseInt(idGrupo, 10),
      corte: corte,
      registros: estudiantes.map(e => ({
        id_registration: e.id_registration,
        criterios: e.criterios,
        desempeno_general: e.desempeno_general,
        observacion: e.observacion,
        reunion_padres: e.reunion_padres,
        horas_ecologicas: e.horas_ecologicas,
      })),
    }),
  })
    .then(res => {
      if (res.status === 403) {
        throw new Error('Solo el maestro guía de este grupo o la dirección pueden guardarlo.');
      }
      if (!res.ok) throw new Error('No se pudo guardar');
      return res.json();
    })
    .then(datos => {
      const registro = datos.Record || datos;
      instantaneaGuardada = instantanea();
      marcarCambios();
      const ahora = new Date().toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('estado-guardado').textContent =
        `Guardado a las ${ahora} (${registro.guardados || estudiantes.length} estudiantes)`;
      showToast('Valores y actitudes guardados', 'success');
    })
    .catch(err => {
      console.error(err);
      showToast(err.message, 'error', 7000);
    })
    .finally(() => {
      boton.disabled = false;
    });
}
