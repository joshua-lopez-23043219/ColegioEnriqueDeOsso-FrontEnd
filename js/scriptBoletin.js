/**
 * scriptBoletin.js — Boletín de calificaciones imprimible.
 *
 * Reproduce la hoja "BOLETIN" del libro del colegio: la ficha del estudiante,
 * el cuadro de asistencia por corte, las horas ecológicas, la parrilla de
 * asignaturas y los criterios de valores y actitudes con las observaciones
 * del docente guía.
 *
 * Todos los datos vienen calculados del servidor (GetStudentBulletin). Aquí
 * no se calcula ninguna nota: solo se pinta lo que llega, para que la hoja
 * impresa y lo que el sistema tiene por dentro no puedan discrepar.
 */

const CORTES = ['I', 'II', 'III', 'IV'];

document.addEventListener('DOMContentLoaded', function () {
  cargarGrupos();

  document.getElementById('sel-grupo').addEventListener('change', cargarEstudiantesDelGrupo);
  document.getElementById('btn-generar').addEventListener('click', generar);
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
  document.getElementById('btn-pdf').addEventListener('click', descargarPdf);
  document.getElementById('btn-pdf-grupo').addEventListener('click', descargarPdfDelGrupo);
  document.getElementById('txt-codigo').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); generar(); }
  });

  const logout = document.getElementById('logout-link');
  if (logout) {
    logout.addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.clear();
      window.location.href = 'vistaPrinc.html';
    });
  }

  // Estudiante y tutor solo ven su propio boletín: se genera solo y se
  // esconde el buscador, igual que hace la pantalla de notas.
  const rol = localStorage.getItem('user_role');
  if (rol === 'ESTUDIANTE' || rol === 'TUTOR') {
    document.getElementById('seccion-busqueda').style.display = 'none';
    const codigo = localStorage.getItem('student_code');
    if (codigo) pedirBoletin({ code_student: codigo });
  }
});

/**
 * Los grupos que esta persona puede consultar, desde el endpoint PROPIO del
 * boletin.
 *
 * Antes se pedian a `ListaGrupos`, compartido con otras cinco pantallas: cada
 * cambio que se hacia alli por otra pantalla llegaba aqui sin aviso.
 */
function cargarGrupos() {
  apiFetch('/apiNote/Note/GruposParaBoletin/')
    .then(res => res.ok ? res.json() : Promise.reject(new Error('grupos')))
    .then(datos => {
      const grupos = datos.grupos || [];
      const select = document.getElementById('sel-grupo');
      select.innerHTML = '<option value="">Seleccione un grupo</option>';
      grupos.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.code_group;
        // La descarga del grupo pide el id, no el codigo: se guarda aqui para
        // no tener que resolverlo con otra consulta.
        opt.dataset.id = g.id;
        opt.textContent = `${g.code_group} - ${g.level_group} (${g.section_group})`;
        select.appendChild(opt);
      });
    })
    .catch(() => showToast('No se pudieron cargar los grupos', 'error'));
}

function cargarEstudiantesDelGrupo() {
  const codigoGrupo = document.getElementById('sel-grupo').value;
  const select = document.getElementById('sel-estudiante');
  if (!codigoGrupo) {
    select.innerHTML = '<option value="">Seleccione un grupo primero</option>';
    return;
  }
  select.innerHTML = '<option value="">Cargando...</option>';

  // El id del grupo, no su codigo: el endpoint propio del boletin ya devuelve
  // los estudiantes con su MATRICULA resuelta, asi que la pantalla no tiene
  // que adivinar cual es la buena. Adivinarla es lo que hacia que un
  // estudiante promovido viera el boletin de su grado anterior.
  const opcion = document.getElementById('sel-grupo').selectedOptions[0];
  const idGrupo = opcion ? opcion.dataset.id : '';

  apiFetch(`/apiNote/Note/GruposParaBoletin/?id_group=${encodeURIComponent(idGrupo)}`)
    .then(res => res.ok ? res.json() : Promise.reject(new Error('estudiantes')))
    .then(datos => {
      const lista = datos.estudiantes || [];
      select.innerHTML = '<option value="">Seleccione un estudiante</option>';
      lista.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.code_student;
        // La matricula exacta viaja en el <option>; `generar()` la usa si
        // esta, y solo cae al codigo cuando la escriben a mano.
        opt.dataset.registration = e.id_registration;
        opt.textContent = e.nombre || e.code_student;
        select.appendChild(opt);
      });
    })
    .catch(() => {
      select.innerHTML = '<option value="">Error al cargar</option>';
      showToast('No se pudieron cargar los estudiantes del grupo', 'error');
    });
}

function generar() {
  const escrito = document.getElementById('txt-codigo').value.trim();
  const seleccion = document.getElementById('sel-estudiante').selectedOptions[0];

  // Con el estudiante elegido de la lista se manda su MATRICULA exacta: no
  // hay forma de que el servidor tenga que adivinar de que ciclo es.
  if (!escrito && seleccion && seleccion.dataset.registration) {
    pedirBoletin({ id_registration: seleccion.dataset.registration });
    return;
  }

  const codigo = (escrito || (seleccion ? seleccion.value : '')).toUpperCase();
  if (!codigo) {
    showToast('Seleccione un estudiante o escriba su código', 'warning');
    return;
  }
  pedirBoletin({ code_student: codigo });
}

function pedirBoletin(parametros) {
  const query = new URLSearchParams(parametros).toString();
  apiFetch(`/apiNote/Note/GetStudentBulletin/?${query}`)
    .then(res => {
      if (res.status === 402) {
        // El sistema bloquea el boletín por mensualidades pendientes.
        return res.json().then(d => Promise.reject(new Error(d.error || 'Boletín bloqueado')));
      }
      if (res.status === 403) throw new Error('No tiene permiso para ver este boletín.');
      if (res.status === 404) throw new Error('Estudiante no encontrado o sin matrícula.');
      if (!res.ok) throw new Error('No se pudo cargar el boletín');
      return res.json();
    })
    .then(datos => {
      pintar(datos.Record || datos);
      document.getElementById('seccion-boletin').style.display = 'block';
    })
    .catch(err => {
      console.error(err);
      document.getElementById('seccion-boletin').style.display = 'none';
      showToast(err.message, 'error', 8000);
    });
}

// ── Pintado ──────────────────────────────────────────────
function celdaCual(valor) {
  if (!valor) return '<span class="vacio">—</span>';
  return `<span class="cual cual-${escapeHtml(valor)}">${escapeHtml(valor)}</span>`;
}

function celdaCuant(valor, esCualitativa) {
  if (esCualitativa) return '<span class="vacio">-----</span>';
  if (!valor) return '<span class="vacio">—</span>';
  return escapeHtml(valor);
}

function pintar(datos) {
  const alumno = datos.student || {};
  const acomp = datos.acompanamiento || { cortes: [], total_horas_ecologicas: 0 };
  const porCorte = {};
  (acomp.cortes || []).forEach(c => { porCorte[c.corte] = c; });

  let html = `
    <div class="hoja__encabezado">
      <div>
        <div class="hoja__titulo">Colegio Enrique de Ossó</div>
        <div class="hoja__subtitulo">Boletín de Calificaciones — Educación Secundaria</div>
      </div>
      <div class="ficha">
        <div><strong>Estudiante:</strong> ${escapeHtml(alumno.name_student || '')}</div>
        <div><strong>Código:</strong> ${escapeHtml(alumno.code_student || '')}</div>
        <div><strong>Grado / Sección:</strong> ${escapeHtml(alumno.level_group || '')} "${escapeHtml(alumno.section_group || '')}"</div>
        <div><strong>Docente guía:</strong> ${escapeHtml(alumno.docente_guia || '—')}</div>
      </div>
    </div>`;

  // ── Asistencia y acompañamiento por corte ──
  html += `<div class="bloque-titulo">Asistencia y acompañamiento</div>
    <table class="bol">
      <thead>
        <tr>
          <th class="izq">Corte evaluativo</th>
          <th>Ausencias justificadas</th>
          <th>Ausencias injustificadas</th>
          <th>Llegadas tarde</th>
          <th>Asistencia de PM/T a reuniones</th>
          <th>Horas ecológicas</th>
        </tr>
      </thead>
      <tbody>`;
  CORTES.forEach(corte => {
    const c = porCorte[corte] || {};
    const reunion = c.reunion_padres === true ? 'SÍ'
      : (c.reunion_padres === false ? 'NO' : '<span class="vacio">—</span>');
    html += `
      <tr>
        <td class="izq"><strong>${corte} Corte</strong></td>
        <td>${c.ausencias_justificadas ?? 0}</td>
        <td>${c.ausencias_injustificadas ?? 0}</td>
        <td>${c.llegadas_tarde ?? 0}</td>
        <td>${reunion}</td>
        <td>${c.horas_ecologicas ?? 0}</td>
      </tr>`;
  });
  html += `
      <tr class="fila-final">
        <td class="izq" colspan="5">Total de horas ecológicas acumuladas</td>
        <td>${acomp.total_horas_ecologicas ?? 0}</td>
      </tr>
      </tbody>
    </table>`;

  // ── Calificaciones ──
  html += `<div class="bloque-titulo">Calificaciones</div>
    <table class="bol">
      <thead>
        <tr>
          <th class="izq" rowspan="2">Asignatura</th>
          <th colspan="2">I Corte</th>
          <th colspan="2">II Corte</th>
          <th colspan="2">I Semestre</th>
          <th colspan="2">III Corte</th>
          <th colspan="2">IV Corte</th>
          <th colspan="2">II Semestre</th>
          <th colspan="2">Nota Final</th>
        </tr>
        <tr>
          ${'<th>Cuant.</th><th>Cual.</th>'.repeat(7)}
        </tr>
      </thead>
      <tbody>`;

  (datos.grades || []).forEach(fila => {
    const esCual = fila.es_cualitativa;
    const campos = ['first_partial', 'second_partial', 'first_semester',
                    'third_partial', 'quarter_partial', 'second_semester', 'final_grade'];
    html += `<tr><td class="izq">${escapeHtml(fila.name_subject)}</td>`;
    campos.forEach(campo => {
      html += `<td>${celdaCuant(fila[campo], esCual)}</td>`;
      html += `<td>${celdaCual(fila[`${campo}_cual`])}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;

  // ── Valores y actitudes ──
  const criterios = datos.criterios_valores || [];
  html += `<div class="bloque-titulo">Valores y actitudes</div>
    <table class="bol">
      <thead>
        <tr>
          <th class="izq">Criterios de valoración</th>
          <th>I C</th><th>II C</th><th>III C</th><th>IV C</th>
        </tr>
      </thead>
      <tbody>`;
  criterios.forEach((texto, i) => {
    html += `<tr><td class="izq criterio-texto">${escapeHtml(texto)}</td>`;
    CORTES.forEach(corte => {
      const c = porCorte[corte] || {};
      html += `<td>${celdaCual((c.criterios || [])[i])}</td>`;
    });
    html += `</tr>`;
  });
  html += `<tr class="fila-final">
      <td class="izq">Desempeño personal y ciudadano</td>`;
  CORTES.forEach(corte => {
    html += `<td>${celdaCual((porCorte[corte] || {}).desempeno_general)}</td>`;
  });
  html += `</tr></tbody></table>`;

  // ── Observaciones ──
  html += `<div class="bloque-titulo">Observaciones del docente guía</div>
    <div class="observaciones">`;
  const conObservacion = CORTES.filter(c => (porCorte[c] || {}).observacion);
  if (conObservacion.length === 0) {
    html += `<span class="vacio">Sin observaciones registradas.</span>`;
  } else {
    conObservacion.forEach(corte => {
      html += `<div class="observacion-corte">
        <strong>${corte} Corte:</strong> ${escapeHtml(porCorte[corte].observacion)}
      </div>`;
    });
  }
  html += `</div>`;

  html += `<div class="leyenda-escala">
      <strong>Escala de valoración:</strong>
      AA — Aprendizaje Avanzado (90-100) &nbsp;·&nbsp;
      AS — Aprendizaje Satisfactorio (76-89) &nbsp;·&nbsp;
      AF — Aprendizaje Fundamental (60-75) &nbsp;·&nbsp;
      AI — Aprendizaje Inicial (0-59)
    </div>`;

  html += `<div class="firmas">
      <div>Docente guía</div>
      <div>Dirección</div>
      <div>Padre / Madre / Tutor</div>
    </div>`;

  document.getElementById('hoja-boletin').innerHTML = html;
}


/**
 * Descarga el boletin con el formato de entrega del colegio.
 *
 * La pantalla y el PDF son cosas distintas y tienen endpoint propio: esta se
 * lee, aquel se imprime y se le entrega a la familia. El archivo se pide con
 * apiFetch para que viaje el token -- un enlace directo no llevaria la
 * autorizacion y el servidor devolveria 401.
 */
function descargarPdf() {
  const codigo = (document.getElementById('txt-codigo').value.trim() ||
                  document.getElementById('sel-estudiante').value).toUpperCase();
  if (!codigo) {
    showToast('Seleccione un estudiante o escriba su código', 'warning');
    return;
  }
  // Sin nombre: lo pone el servidor, que es quien sabe como se llama el
  // estudiante y en que grado esta.
  bajarArchivo(
    `/apiNote/Note/DescargarBoletin/?code_student=${encodeURIComponent(codigo)}`);
}

/**
 * Los boletines del grupo, un archivo por estudiante dentro de un ZIP.
 *
 * El colegio los imprime y los entrega uno por uno: un solo PDF con los 40
 * obligaria a partirlo a mano. Cada archivo sale nombrado con el estudiante
 * y su grado.
 */
function descargarPdfDelGrupo() {
  const select = document.getElementById('sel-grupo');
  const opcion = select.options[select.selectedIndex];
  const idGrupo = opcion && opcion.dataset.id;
  if (!idGrupo) {
    showToast('Seleccione un grupo', 'warning');
    return;
  }
  showToast('Generando los boletines del grupo...', 'info');
  bajarArchivo(
    `/apiNote/Note/DescargarBoletinesGrupo/?id_group=${encodeURIComponent(idGrupo)}`);
}

/**
 * Descarga lo que devuelva el endpoint, con el nombre que el servidor indique.
 *
 * El nombre viaja en la cabecera `Content-Disposition`. Ponerlo aqui obligaria
 * a repetir en el navegador la regla de como se arma --nombre del estudiante y
 * grado-- y las dos copias se separarian.
 */
function nombreDelServidor(res, porDefecto) {
  const cabecera = res.headers.get('Content-Disposition') || '';
  const marca = cabecera.match(/filename="?([^"]+)"?/);
  return marca ? marca[1] : porDefecto;
}

function bajarArchivo(url) {
  let nombre = 'boletin.pdf';
  apiFetch(url)
    .then(res => {
      if (res.status === 402) {
        throw new Error('El boletín está bloqueado por mensualidades pendientes.');
      }
      if (res.status === 403) {
        throw new Error('No tiene autorización para descargar este boletín.');
      }
      if (res.status === 404) throw new Error('No se encontró el boletín.');
      if (!res.ok) throw new Error('No se pudo generar el archivo');
      // El nombre se lee ANTES de pasar a blob: despues ya no hay cabeceras.
      nombre = nombreDelServidor(res, nombre);
      return res.blob();
    })
    .then(blob => {
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(blob);
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(enlace.href);
      showToast('Descarga lista', 'success');
    })
    .catch(err => showToast(err.message, 'error'));
}
