/**
 * scriptDashboard.js — Dashboard del Director (v2)
 *
 * Consume GET /apiAnalitica/Analitica/dashboard/ y presenta indicadores
 * orientados a la toma de decisiones: KPIs de riesgo, evolución histórica,
 * focos de atención (asignatura × docente × grupo) y distribuciones.
 *
 * Todo el contenido dinámico se inserta con textContent / nodos DOM, así que
 * los nombres que vienen de la base de datos no pueden inyectar HTML.
 */
(function () {
  'use strict';

  // Paleta alineada con el sistema de diseño (global.css).
  var C = {
    primary: '#4F46E5',
    primarySoft: 'rgba(79, 70, 229, 0.14)',
    accent: '#F59E0B',
    accentSoft: 'rgba(245, 158, 11, 0.18)',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
    slate500: '#64748B',
  };

  var UMBRAL = 60;
  var charts = {};

  // ---------------- utilidades ----------------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function fmt(v, dec) {
    if (v === null || v === undefined) return '—';
    return Number(v).toFixed(dec === undefined ? 1 : dec);
  }

  function colorNota(v) {
    if (v === null || v === undefined) return C.slate500;
    if (v < UMBRAL) return C.danger;
    if (v < 70) return C.warning;
    if (v < 85) return C.primary;
    return C.success;
  }

  function skeleton(host, alto) {
    host.textContent = '';
    var s = el('div', 'skeleton');
    s.style.height = (alto || 120) + 'px';
    host.appendChild(s);
  }

  function vacio(host, mensaje) {
    host.textContent = '';
    var box = el('div', 'empty');
    box.appendChild(el('span', 'empty__icon', '📭'));
    box.appendChild(document.createTextNode(mensaje));
    host.appendChild(box);
  }

  function destruir(nombre) {
    if (charts[nombre]) { charts[nombre].destroy(); delete charts[nombre]; }
  }

  // ---------------- KPIs ----------------
  function renderKpis(k) {
    var host = document.getElementById('kpis');
    host.textContent = '';

    var riesgoColor = (k.porcentaje_riesgo !== null && k.porcentaje_riesgo > 15)
      ? C.danger : C.warning;

    var tarjetas = [
      { label: 'Estudiantes activos', valor: k.estudiantes_activos, unidad: '',
        pie: 'Matriculados este año', color: C.primary },
      { label: 'Promedio general', valor: fmt(k.promedio_general), unidad: '/100',
        pie: 'Histórico de todas las notas', color: colorNota(k.promedio_general) },
      { label: 'Asistencia', valor: fmt(k.tasa_asistencia), unidad: '%',
        pie: 'Promedio de presencia', color: C.info },
      { label: 'En riesgo', valor: k.en_riesgo, unidad: '',
        pie: (k.porcentaje_riesgo !== null && k.porcentaje_riesgo !== undefined
              ? fmt(k.porcentaje_riesgo) + '% con promedio bajo ' + UMBRAL
              : 'Sin datos'),
        color: riesgoColor },
      { label: 'Retención', valor: fmt(k.tasa_retencion), unidad: '%',
        pie: 'Matrículas que son reingreso', color: C.success },
    ];

    tarjetas.forEach(function (t) {
      var card = el('div', 'kpi');
      card.style.setProperty('--kpi-color', t.color);
      card.appendChild(el('div', 'kpi__label', t.label));
      var v = el('div', 'kpi__value',
        (t.valor === null || t.valor === undefined) ? '—' : String(t.valor));
      if (t.unidad) v.appendChild(el('span', 'kpi__unit', t.unidad));
      card.appendChild(v);
      card.appendChild(el('div', 'kpi__foot', t.pie));
      host.appendChild(card);
    });
  }

  // ---------------- Tendencia ----------------
  function renderTendencia(datos) {
    destruir('tendencia');
    var ctx = document.getElementById('chartTendencia');
    if (!datos.length) return;

    charts.tendencia = new Chart(ctx, {
      type: 'line',
      data: {
        labels: datos.map(function (d) { return d.anio; }),
        datasets: [
          {
            label: 'Promedio de notas',
            data: datos.map(function (d) { return d.promedio; }),
            borderColor: C.primary, backgroundColor: C.primarySoft,
            borderWidth: 3, tension: 0.35, fill: true,
            pointRadius: 5, pointBackgroundColor: C.primary, yAxisID: 'y',
          },
          {
            label: 'Asistencia (%)',
            data: datos.map(function (d) { return d.asistencia; }),
            borderColor: C.accent, backgroundColor: C.accentSoft,
            borderWidth: 3, tension: 0.35, fill: true,
            pointRadius: 5, pointBackgroundColor: C.accent, yAxisID: 'y1',
            borderDash: [6, 4],
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
          tooltip: {
            callbacks: {
              afterBody: function (items) {
                var d = datos[items[0].dataIndex];
                return 'Matrículas: ' + d.matriculas;
              },
            },
          },
        },
        scales: {
          y: { title: { display: true, text: 'Nota' }, suggestedMin: 50, suggestedMax: 100 },
          y1: {
            position: 'right', title: { display: true, text: 'Asistencia %' },
            suggestedMin: 50, suggestedMax: 100, grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }

  // ---------------- Focos de atención ----------------
  function renderCriticos(lista) {
    var host = document.getElementById('tabla-criticos');
    host.textContent = '';
    if (!lista || !lista.length) {
      vacio(host, 'Sin focos de atención: ningún segmento con muestra suficiente está por debajo del umbral.');
      return;
    }

    var tabla = el('table', 'tbl tbl--wide');
    var thead = el('thead');
    var trh = el('tr');
    ['Asignatura', 'Docente', 'Grupo', 'Promedio', 'Reprobados', 'Estudiantes']
      .forEach(function (h, i) {
        var th = el('th', null, h);
        if (i >= 3) th.style.textAlign = 'right';
        trh.appendChild(th);
      });
    thead.appendChild(trh);
    tabla.appendChild(thead);

    var tbody = el('tbody');
    lista.forEach(function (s) {
      var tr = el('tr');
      tr.appendChild(el('td', null, s.asignatura));
      tr.appendChild(el('td', null, s.docente));

      var tdG = el('td');
      tdG.appendChild(el('span', 'status-pill status-pill--primary', s.grupo));
      tr.appendChild(tdG);

      var tdP = el('td', 'tbl__num');
      var badge = el('span');
      badge.className = 'status-pill ' + (s.promedio < UMBRAL
        ? 'status-pill--danger' : 'status-pill--warning');
      badge.textContent = fmt(s.promedio);
      tdP.appendChild(badge);
      tr.appendChild(tdP);

      tr.appendChild(el('td', 'tbl__num', String(s.reprobados)));
      tr.appendChild(el('td', 'tbl__num', String(s.estudiantes)));
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
    var wrap = el('div', 'tbl-wrap');
    wrap.appendChild(tabla);
    host.appendChild(wrap);
  }

  // ---------------- Barras horizontales (docentes / asignaturas) ----------------
  function renderBarras(nombre, canvasId, lista, campo) {
    destruir(nombre);
    var ctx = document.getElementById(canvasId);
    if (!lista || !lista.length) return;

    charts[nombre] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: lista.map(function (d) { return d[campo]; }),
        datasets: [{
          label: 'Promedio',
          data: lista.map(function (d) { return d.promedio; }),
          backgroundColor: lista.map(function (d) { return colorNota(d.promedio); }),
          borderRadius: 6, borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: function (item) {
                return lista[item.dataIndex].evaluaciones + ' evaluaciones';
              },
            },
          },
        },
        scales: {
          x: { suggestedMin: 40, suggestedMax: 100, title: { display: true, text: 'Promedio' } },
          y: { ticks: { autoSkip: false } },
        },
      },
    });
  }

  // ---------------- Histograma ----------------
  function renderHistograma(datos) {
    destruir('histograma');
    var ctx = document.getElementById('chartHistograma');
    if (!datos || !datos.length) return;

    charts.histograma = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: datos.map(function (d) { return d.rango; }),
        datasets: [{
          label: 'Calificaciones',
          data: datos.map(function (d) { return d.cantidad; }),
          backgroundColor: datos.map(function (d) {
            return parseInt(d.rango, 10) < UMBRAL ? C.danger : C.primary;
          }),
          borderRadius: 6, borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'Rango de nota' } },
          y: { title: { display: true, text: 'Cantidad' }, beginAtZero: true },
        },
      },
    });
  }

  // ---------------- Niveles ----------------
  function renderNiveles(lista) {
    var host = document.getElementById('tabla-niveles');
    host.textContent = '';
    if (!lista || !lista.length) {
      vacio(host, 'Sin datos de niveles todavía.');
      return;
    }

    var tabla = el('table', 'tbl');
    var thead = el('thead');
    var trh = el('tr');
    ['Nivel', 'Promedio', 'Estudiantes'].forEach(function (h, i) {
      var th = el('th', null, h);
      if (i > 0) th.style.textAlign = 'right';
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    tabla.appendChild(thead);

    var tbody = el('tbody');
    lista.forEach(function (n) {
      var tr = el('tr');
      tr.appendChild(el('td', null, n.nivel || '—'));

      var tdP = el('td', 'tbl__num');
      var b = el('span');
      b.className = 'status-pill ' + (n.promedio < UMBRAL ? 'status-pill--danger'
        : (n.promedio < 70 ? 'status-pill--warning' : 'status-pill--success'));
      b.textContent = fmt(n.promedio);
      tdP.appendChild(b);
      tr.appendChild(tdP);

      tr.appendChild(el('td', 'tbl__num', String(n.estudiantes)));
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
    var wrap = el('div', 'tbl-wrap');
    wrap.appendChild(tabla);
    host.appendChild(wrap);
  }

  // ---------------- Carga ----------------
  function cargar(forzar) {
    var btn = document.getElementById('btn-refresh');
    var sub = document.getElementById('dash-sub');
    btn.disabled = true;
    sub.textContent = 'Calculando indicadores…';

    skeleton(document.getElementById('kpis'), 110);
    skeleton(document.getElementById('tabla-criticos'), 160);
    skeleton(document.getElementById('tabla-niveles'), 160);

    var url = '/apiAnalitica/Analitica/dashboard/' + (forzar ? '?refresh=1' : '');

    apiFetch(url)
      .then(function (res) {
        if (res.status === 403) throw new Error('Solo el Director puede ver este panel.');
        if (!res.ok) throw new Error('No se pudieron cargar los indicadores.');
        return res.json();
      })
      .then(function (d) {
        document.getElementById('kpis').textContent = '';
        renderKpis(d.kpis || {});
        renderTendencia(d.tendencia || []);
        renderCriticos(d.segmentos_criticos || []);
        renderBarras('docentes', 'chartDocentes', d.docentes || [], 'docente');
        renderBarras('asignaturas', 'chartAsignaturas', d.asignaturas || [], 'asignatura');
        renderHistograma(d.histograma || []);
        renderNiveles(d.niveles || []);

        var k = d.kpis || {};
        sub.textContent = (k.total_notas || 0).toLocaleString('es-NI')
          + ' calificaciones analizadas · ' + (d.grupos_totales || 0) + ' grupos'
          + (d.cacheado ? ' · datos en caché' : ' · recién calculado');
      })
      .catch(function (err) {
        sub.textContent = err.message;
        vacio(document.getElementById('kpis'), err.message);
        document.getElementById('tabla-criticos').textContent = '';
        document.getElementById('tabla-niveles').textContent = '';
        if (typeof showToast === 'function') showToast(err.message, 'error');
      })
      .finally(function () { btn.disabled = false; });
  }

  // Hook para validación local: permite pintar el panel con un payload dado
  // sin depender de la API (mismo enfoque que el Portal del Estudiante).
  window.__dashRender = function (d) {
    document.getElementById('kpis').textContent = '';
    renderKpis(d.kpis || {});
    renderTendencia(d.tendencia || []);
    renderCriticos(d.segmentos_criticos || []);
    renderBarras('docentes', 'chartDocentes', d.docentes || [], 'docente');
    renderBarras('asignaturas', 'chartAsignaturas', d.asignaturas || [], 'asignatura');
    renderHistograma(d.histograma || []);
    renderNiveles(d.niveles || []);
    var k = d.kpis || {};
    document.getElementById('dash-sub').textContent =
      (k.total_notas || 0).toLocaleString('es-NI') + ' calificaciones analizadas · '
      + (d.grupos_totales || 0) + ' grupos';
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (localStorage.getItem('user_role') !== 'DIRECTOR') return;
    document.getElementById('btn-refresh').addEventListener('click', function () {
      cargar(true);
    });
    cargar(false);
  });
})();
