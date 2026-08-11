/**
 * scriptConsolidado.js — Consolidado diario de asistencia de toda la secundaria.
 *
 * Formato MINED: por sección, Matrícula (AS/M) contra Asistencia (AS/M),
 * con subtotal por grado y total general.
 *   AS = Ambos Sexos (el total)
 *   M  = Mujeres
 *
 * Los números NO se capturan a mano: se derivan de la asistencia que los
 * docentes pasan en la primera hora de clase. Por eso la pantalla también
 * muestra qué docentes aún no la han enviado — sin ese dato el consolidado
 * quedaría incompleto sin que nadie lo note.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

document.addEventListener('DOMContentLoaded', function () {
  const inputFecha = document.getElementById('fecha-consolidado');
  inputFecha.value = hoyISO();

  document.getElementById('btn-cargar').addEventListener('click', cargarConsolidado);
  inputFecha.addEventListener('change', cargarConsolidado);
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

  const logoutBtn = document.getElementById('logout-link');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.clear();
      window.location.href = 'vistaPrinc.html';
    });
  }

  cargarConsolidado();
});

// Fecha de hoy en formato YYYY-MM-DD según el reloj local del navegador.
// No se usa toISOString(): esa convierte a UTC y en Nicaragua (UTC-6)
// devolvería el día siguiente a partir de las 6 de la tarde.
function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function fechaLegible(iso, diaSemana) {
  const partes = String(iso).split('-');
  if (partes.length !== 3) return iso;
  const dia = parseInt(partes[2], 10);
  const mes = MESES[parseInt(partes[1], 10) - 1] || '';
  return `${diaSemana || ''} ${dia} de ${mes} de ${partes[0]}`.trim();
}

function cargarConsolidado() {
  const fecha = document.getElementById('fecha-consolidado').value || hoyISO();
  const contenido = document.getElementById('reporte-contenido');
  contenido.innerHTML = '<p style="text-align:center; padding:30px; color:var(--gray-600);">Cargando consolidado...</p>';

  apiFetch(`/apiNon_Attendance/Non_Attendance/ConsolidadoAsistencia/?date=${encodeURIComponent(fecha)}`)
    .then(res => {
      if (res.status === 403) throw new Error('No tiene autorización para ver el consolidado de asistencia.');
      if (!res.ok) throw new Error('No se pudo obtener el consolidado.');
      return res.json();
    })
    .then(resData => {
      const datos = resData.Record || resData;
      renderReporte(datos);
      renderAlerta(datos);
    })
    .catch(err => {
      contenido.innerHTML = `<p style="text-align:center; padding:30px; color:var(--danger); font-weight:600;">❌ ${escapeHtml(err.message)}</p>`;
      document.getElementById('alerta-pendientes').innerHTML = '';
      showToast(err.message, 'error');
    });
}

function renderReporte(datos) {
  const contenido = document.getElementById('reporte-contenido');
  document.getElementById('reporte-fecha').textContent = fechaLegible(datos.fecha, datos.dia_semana);
  document.getElementById('reporte-subtitulo').textContent = `Educación Secundaria — Ciclo lectivo ${datos.ciclo}`;

  if (!datos.hay_clases) {
    contenido.innerHTML = `<p style="text-align:center; padding:30px; color:var(--gray-600);">
      No hay clases programadas para ${escapeHtml(datos.dia_semana)}. El consolidado solo aplica a días de clase.
    </p>`;
    return;
  }

  if (!datos.grados || datos.grados.length === 0) {
    contenido.innerHTML = `<p style="text-align:center; padding:30px; color:var(--gray-600);">
      No hay estudiantes matriculados en el ciclo ${escapeHtml(String(datos.ciclo))}.
    </p>`;
    return;
  }

  let html = `
    <div style="overflow-x:auto;">
    <table class="tabla-consolidado">
      <thead>
        <tr>
          <th class="col-grupo" rowspan="2">Grado / Sección</th>
          <th class="col-grupo" rowspan="2">Maestro Guía</th>
          <th colspan="2">Matrícula</th>
          <th colspan="2">Asistencia</th>
          <th rowspan="2">Ausentes</th>
          <th rowspan="2">% Asist.</th>
        </tr>
        <tr>
          <th>AS</th>
          <th>M</th>
          <th>AS</th>
          <th>M</th>
        </tr>
      </thead>
      <tbody>`;

  datos.grados.forEach(bloque => {
    bloque.filas.forEach(fila => {
      const claseFila = fila.sin_registro ? 'fila-sin-registro' : '';
      const porcentaje = fila.sin_registro
        ? '<span class="dato-vacio">—</span>'
        : `${fila.porcentaje}%`;
      const asistenciaAS = fila.sin_registro ? '<span class="dato-vacio">—</span>' : fila.asistencia_as;
      const asistenciaM = fila.sin_registro ? '<span class="dato-vacio">—</span>' : fila.asistencia_m;
      const ausentes = fila.sin_registro ? '<span class="dato-vacio">—</span>' : fila.ausentes;

      html += `
        <tr class="${claseFila}">
          <td class="col-grupo">${escapeHtml(fila.grado)} "${escapeHtml(fila.seccion)}"</td>
          <td class="col-grupo" style="font-weight:400; font-size:0.85rem;">${escapeHtml(fila.guia || '—')}</td>
          <td>${fila.matricula_as}</td>
          <td>${fila.matricula_m}</td>
          <td>${asistenciaAS}</td>
          <td>${asistenciaM}</td>
          <td>${ausentes}</td>
          <td>${porcentaje}</td>
        </tr>`;
    });

    const sub = bloque.subtotal;
    html += `
      <tr class="fila-subtotal">
        <td class="col-grupo" colspan="2">Subtotal ${escapeHtml(bloque.grado)}</td>
        <td>${sub.matricula_as}</td>
        <td>${sub.matricula_m}</td>
        <td>${sub.asistencia_as}</td>
        <td>${sub.asistencia_m}</td>
        <td>${sub.ausentes}</td>
        <td>${sub.porcentaje !== null ? sub.porcentaje + '%' : '—'}</td>
      </tr>`;
  });

  const total = datos.total;
  html += `
      <tr class="fila-total">
        <td class="col-grupo" colspan="2">TOTAL SECUNDARIA</td>
        <td>${total.matricula_as}</td>
        <td>${total.matricula_m}</td>
        <td>${total.asistencia_as}</td>
        <td>${total.asistencia_m}</td>
        <td>${total.ausentes}</td>
        <td>${total.porcentaje !== null ? total.porcentaje + '%' : '—'}</td>
      </tr>
      </tbody>
    </table>
    </div>`;

  contenido.innerHTML = html;
}

function renderAlerta(datos) {
  const cont = document.getElementById('alerta-pendientes');
  const pendientes = datos.docentes_pendientes || [];

  if (!datos.hay_clases) {
    cont.innerHTML = '';
    return;
  }

  if (pendientes.length === 0) {
    cont.innerHTML = `
      <div class="alerta alerta--ok">
        <div class="alerta__titulo">✅ Todos los docentes han enviado su asistencia</div>
        No hay clases pendientes de registrar${datos.es_hoy ? ' hasta esta hora' : ''}.
      </div>`;
    return;
  }

  const primeraHora = pendientes.filter(p => p.primera_hora);
  const resto = pendientes.filter(p => !p.primera_hora);

  const itemHtml = (p) => `
    <li>
      <strong>${escapeHtml(p.docente)}</strong> — ${escapeHtml(p.code_group)} ·
      ${escapeHtml(p.materia)} <span style="color:#92400E;">(${escapeHtml(p.hora)})</span>
      ${p.primera_hora ? '<span class="badge-1ra">1ra hora</span>' : ''}
    </li>`;

  let detalle = '';
  if (primeraHora.length) {
    detalle += `<p style="margin:6px 0 4px 0; font-weight:600;">Primera hora (afecta directamente al consolidado):</p>
      <ul class="alerta__lista">${primeraHora.map(itemHtml).join('')}</ul>`;
  }
  if (resto.length) {
    detalle += `<p style="margin:14px 0 4px 0; font-weight:600;">Otras horas ya transcurridas:</p>
      <ul class="alerta__lista">${resto.map(itemHtml).join('')}</ul>`;
  }

  const sinRegistro = datos.grupos_sin_registro
    ? ` ${datos.grupos_sin_registro} sección(es) quedan fuera del conteo por esta razón.`
    : '';

  cont.innerHTML = `
    <div class="alerta alerta--pendiente">
      <div class="alerta__titulo">
        ⚠️ ${pendientes.length} clase(s) sin asistencia registrada
      </div>
      <p style="margin-bottom:8px;">
        Los siguientes docentes aún no han enviado la asistencia
        ${datos.es_hoy ? 'de clases que ya ocurrieron hoy' : `del ${escapeHtml(datos.fecha)}`}.${escapeHtml(sinRegistro)}
      </p>
      ${detalle}
    </div>`;
}
