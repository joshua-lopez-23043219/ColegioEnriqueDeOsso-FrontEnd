/**
 * scriptActa.js — Acta de calificación del grupo.
 *
 * Reproduce las hojas "NOTA I CORTE", "NOTA II CORTE" y "NOTA I SEMESTRE" del
 * libro del colegio: una fila por estudiante, una columna por asignatura con
 * su nota (CT) y su letra (CL), más el desempeño personal y ciudadano y las
 * columnas de resumen.
 *
 * Nada se calcula aquí: todo llega listo del servidor.
 */

document.addEventListener('DOMContentLoaded', function () {
  cargarGrupos();
  document.getElementById('btn-generar').addEventListener('click', generar);
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
  document.getElementById('btn-mined').addEventListener('click', descargarMined);

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
  apiFetch('/apiGroup/Group/ListaGrupos/')
    .then(res => res.ok ? res.json() : Promise.reject(new Error('grupos')))
    .then(datos => {
      const grupos = Array.isArray(datos) ? datos : (datos.Record || []);
      const select = document.getElementById('sel-grupo');
      select.innerHTML = '<option value="">Seleccione un grupo</option>';
      grupos.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = `${g.code_group} - ${g.level_group} (${g.section_group})`;
        select.appendChild(opt);
      });
    })
    .catch(() => showToast('No se pudieron cargar los grupos', 'error'));
}

function generar() {
  const idGrupo = document.getElementById('sel-grupo').value;
  const corte = document.getElementById('sel-corte').value;
  if (!idGrupo) {
    showToast('Seleccione un grupo', 'warning');
    return;
  }

  apiFetch(`/apiNote/Note/GetActaCorte/?id_group=${encodeURIComponent(idGrupo)}&corte=${encodeURIComponent(corte)}`)
    .then(res => {
      if (res.status === 403) {
        throw new Error('Solo el maestro guía de este grupo o la dirección pueden ver el acta.');
      }
      if (!res.ok) throw new Error('No se pudo generar el acta');
      return res.json();
    })
    .then(datos => {
      pintarActa(datos.Record || datos);
      document.getElementById('seccion-acta').style.display = 'block';
    })
    .catch(err => {
      console.error(err);
      document.getElementById('seccion-acta').style.display = 'none';
      showToast(err.message, 'error', 7000);
    });
}

function celdaCual(valor) {
  if (!valor) return '<span class="vacio">—</span>';
  return `<span class="cual cual-${escapeHtml(valor)}">${escapeHtml(valor)}</span>`;
}

function pintarActa(datos) {
  const asignaturas = datos.asignaturas || [];
  const estudiantes = datos.estudiantes || [];

  document.getElementById('acta-sub').textContent =
    `${datos.level_group} "${datos.section_group}" — ${datos.etiqueta_corte} · ` +
    `Año lectivo ${datos.anio_lectivo} · Docente guía: ${datos.docente_guia || '—'} · ` +
    `${estudiantes.length} estudiantes`;

  // ── Encabezado: dos filas, la asignatura sobre sus columnas CT/CL ──
  let filaMaterias = '<tr>' +
    '<th class="col-num" rowspan="2">N°</th>' +
    '<th class="col-nombre" rowspan="2">Nombres y Apellidos</th>' +
    '<th rowspan="2">Código</th>' +
    '<th rowspan="2">Sexo</th>';
  let filaTipos = '<tr>';

  asignaturas.forEach(a => {
    const columnas = a.es_cualitativa ? 1 : 2;
    filaMaterias += `<th class="materia" colspan="${columnas}">${escapeHtml(a.nombre)}</th>`;
    if (a.es_cualitativa) {
      filaTipos += '<th>CL</th>';
    } else {
      filaTipos += '<th>CT</th><th>CL</th>';
    }
  });

  filaMaterias += '<th class="materia" rowspan="2">Desempeño personal y ciudadano</th>' +
    '<th class="col-resumen" rowspan="2">Reprueban</th>' +
    '<th class="col-resumen" colspan="2">Promedio</th>' +
    '<th class="col-resumen" rowspan="2">AA</th>' +
    '<th class="col-resumen" rowspan="2">AS</th>' +
    '<th class="col-resumen" rowspan="2">AF</th>' +
    '<th class="col-resumen" rowspan="2">AI</th></tr>';
  // El promedio lleva su letra al lado, igual que en el acta del colegio.
  filaTipos += '<th class="col-resumen">CT</th><th class="col-resumen">CL</th></tr>';

  let html = `<thead>${filaMaterias}${filaTipos}</thead><tbody>`;

  estudiantes.forEach(alumno => {
    html += `<tr>
      <td class="col-num">${alumno.numero}</td>
      <td class="col-nombre">${escapeHtml(alumno.name_student)}</td>
      <td>${escapeHtml(alumno.code_student || '—')}</td>
      <td>${escapeHtml(alumno.sexo || '—')}</td>`;

    asignaturas.forEach(a => {
      const nota = (alumno.notas || {})[a.nombre] || { cuant: '', cual: '' };
      if (!a.es_cualitativa) {
        html += `<td>${nota.cuant ? escapeHtml(nota.cuant) : '<span class="vacio">—</span>'}</td>`;
      }
      html += `<td>${celdaCual(nota.cual)}</td>`;
    });

    const conteo = alumno.conteo || {};
    html += `
      <td>${celdaCual(alumno.desempeno)}</td>
      <td class="col-resumen ${alumno.reprueban > 0 ? 'reprueba' : ''}">${alumno.reprueban}</td>
      <td class="col-resumen">${alumno.promedio || '<span class="vacio">—</span>'}</td>
      <td class="col-resumen">${celdaCual(alumno.promedio_cual)}</td>
      <td class="col-resumen">${conteo.AA || 0}</td>
      <td class="col-resumen">${conteo.AS || 0}</td>
      <td class="col-resumen">${conteo.AF || 0}</td>
      <td class="col-resumen">${conteo.AI || 0}</td>
    </tr>`;
  });

  html += '</tbody>';
  document.getElementById('tabla-acta').innerHTML = html;

  document.getElementById('nota-promedio').innerHTML =
    '<strong>Sobre la columna Promedio:</strong> se calcula sobre las asignaturas que ' +
    'realmente llevan nota numérica. En el libro de Excel del colegio esta columna divide ' +
    'entre todas las materias marcadas como cuantitativas, y una de ellas (Tecnología) solo ' +
    'lleva letra: al no tener número cuenta como cero y baja el promedio de cada estudiante ' +
    'unos 14 puntos. Por eso este valor no coincide con el del libro — el del libro está mal.';
}

/**
 * Descarga el formato de recoleccion del MINED.
 *
 * Se pide con apiFetch para que viaje el token, y el archivo se guarda desde
 * el blob de la respuesta: un enlace directo no llevaria la autorizacion y el
 * servidor devolveria 401.
 */
function descargarMined() {
  const idGrupo = document.getElementById('sel-grupo').value;
  const corte = document.getElementById('sel-corte').value;
  if (!idGrupo) {
    showToast('Seleccione un grupo', 'warning');
    return;
  }

  showToast('Generando el archivo...', 'info');
  apiFetch(`/apiNote/Note/ExportarICMINED/?id_group=${encodeURIComponent(idGrupo)}&corte=${encodeURIComponent(corte)}`)
    .then(res => {
      if (res.status === 403) {
        throw new Error('Solo el maestro guía de este grupo o la dirección pueden exportar.');
      }
      if (!res.ok) throw new Error('No se pudo generar el archivo');
      return res.blob();
    })
    .then(blob => {
      const grupo = document.getElementById('sel-grupo');
      const etiqueta = grupo.options[grupo.selectedIndex].textContent.split(' - ')[0];
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `IC-MINED ${etiqueta} ${corte}.xlsx`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);
      showToast('Archivo descargado', 'success');
    })
    .catch(err => {
      console.error(err);
      showToast(err.message, 'error', 7000);
    });
}
