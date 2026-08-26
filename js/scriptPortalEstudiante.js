/**
 * scriptPortalEstudiante.js — Portal del Estudiante (solo ESTUDIANTE)
 *
 * Consume GET /apiNote/Note/GetStudentBulletin/ (el backend devuelve el boletín
 * del propio estudiante autenticado) y lo presenta como un panel visual:
 * promedio general, estadísticas y tarjetas por asignatura con anillos SVG.
 *
 * Todo el contenido dinámico se inserta con textContent / nodos DOM -> sin XSS.
 * Los anillos son SVG hechos a mano (sin librerías externas ni eval) -> CSP-safe.
 */
(function () {
  'use strict';

  // ---------- Utilidades de nota ----------
  /**
   * Punto medio del rango de cada categoría de logro.
   *
   * Es la MISMA tabla que usa el backend (`Subjects.EQUIVALENCIA_NUMERICA`),
   * que ya la aplican el boletín, el acta y el dashboard. Si se cambia allá,
   * hay que cambiarla aquí.
   */
  var CUALITATIVA = { AA: 95, AS: 82.5, AF: 67.5, AI: 45 };

  /**
   * La nota como número, venga como cifra o como categoría.
   *
   * Antes solo entendía cifras: `parseFloat('AA')` da NaN, así que toda
   * asignatura cualitativa --Derecho y Dignidad de la Mujer, Creciendo en
   * Valores, Talleres de Arte-- quedaba en nulo. El estudiante la veía como
   * "Sin notas" y NO contaba en su promedio, ni en "Aprobadas", ni en "En
   * riesgo": sus KPIs se calculaban sobre media docena de asignaturas en vez
   * de sobre todas.
   */
  function parseNum(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim();
    if (!s) return null;
    var codigo = CUALITATIVA[s.toUpperCase()];
    if (codigo !== undefined) return codigo;
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  /** `true` si la nota vino como categoría (AA/AS/AF/AI) y no como cifra. */
  function esCualitativa(v) {
    return v !== null && v !== undefined &&
           CUALITATIVA[String(v).trim().toUpperCase()] !== undefined;
  }

  function avg(list) {
    var vals = list.filter(function (v) { return v !== null; });
    if (!vals.length) return null;
    var sum = vals.reduce(function (a, b) { return a + b; }, 0);
    return sum / vals.length;
  }

  /**
   * El valor de un campo de nota, mire donde mire el boletín.
   *
   * EL PROBLEMA QUE RESUELVE
   * En una asignatura CUALITATIVA (Derecho y Dignidad de la Mujer, Creciendo
   * en Valores, Talleres de Arte) el backend deja los campos numéricos
   * VACÍOS y pone la letra en un campo aparte: `first_partial_cual`,
   * `final_grade_cual`, etc. Así lo necesita el boletín impreso, que lleva
   * dos columnas por corte (CT y CL).
   *
   * Este portal solo leía los numéricos, así que veía esas asignaturas como
   * si no tuvieran ni una nota: salían "Sin notas" y quedaban FUERA del
   * promedio, de "Aprobadas" y de "En riesgo". Los KPIs del estudiante se
   * calculaban sobre una parte de sus asignaturas.
   */
  function campo(g, nombre) {
    var directo = g[nombre];
    if (directo !== null && directo !== undefined && String(directo).trim()) {
      return directo;
    }
    return g[nombre + '_cual'];
  }

  // Nota "actual" de una asignatura: preferimos la final; si no, promedio de
  // semestres disponibles; si no, promedio de parciales disponibles.
  function subjectCurrent(g) {
    var fin = parseNum(campo(g, 'final_grade'));
    if (fin !== null) return fin;
    var sems = avg([parseNum(campo(g, 'first_semester')),
                    parseNum(campo(g, 'second_semester'))]);
    if (sems !== null) return sems;
    return avg(partialsOf(g));
  }

  function partialsOf(g) {
    return [
      parseNum(campo(g, 'first_partial')), parseNum(campo(g, 'second_partial')),
      parseNum(campo(g, 'third_partial')), parseNum(campo(g, 'quarter_partial'))
    ];
  }

  // Banda de color/etiqueta según la nota (escala 0-100, aprobado 60).
  function band(v) {
    if (v === null) return { color: '#9a94ad', label: 'Sin notas' };
    if (v >= 90) return { color: 'var(--pe-excellent)', label: '¡Excelente!' };
    if (v >= 80) return { color: 'var(--pe-good)', label: 'Muy bien' };
    if (v >= 70) return { color: 'var(--pe-ok)', label: 'Bien' };
    if (v >= 60) return { color: 'var(--pe-warn)', label: 'Puedes mejorar' };
    return { color: 'var(--pe-risk)', label: 'En riesgo' };
  }

  /**
   * La nota como ENTERO, redondeando hacia arriba en el .5.
   *
   * El colegio califica con enteros: el boletín, el acta y el consolidado ya
   * lo hacen así (`Apps/Utils/notas.py`). Este portal era el único sitio que
   * mostraba decimales -- un 80.5 que sale de promediar el I y el II corte --
   * y el estudiante veía una nota distinta a la de su boletín.
   *
   * `Math.round` de JavaScript sí redondea el .5 hacia arriba, a diferencia
   * del `round()` de Python, que manda al par más cercano.
   */
  function fmt(v) {
    if (v === null) return '—';
    return String(Math.round(v));
  }

  // ---------- Anillo SVG ----------
  var SVGNS = 'http://www.w3.org/2000/svg';

  function makeRing(pct, centerText, subText, color, size, stroke) {
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var wrap = document.createElement('div');
    wrap.className = 'pe-ring' + (size <= 90 ? ' pe-ring--sm' : '');
    wrap.style.width = size + 'px';
    wrap.style.height = size + 'px';

    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);

    var track = document.createElementNS(SVGNS, 'circle');
    track.setAttribute('class', 'pe-ring__track');
    track.setAttribute('cx', size / 2);
    track.setAttribute('cy', size / 2);
    track.setAttribute('r', r);
    track.setAttribute('stroke-width', stroke);

    var fill = document.createElementNS(SVGNS, 'circle');
    fill.setAttribute('class', 'pe-ring__fill');
    fill.setAttribute('cx', size / 2);
    fill.setAttribute('cy', size / 2);
    fill.setAttribute('r', r);
    fill.setAttribute('stroke-width', stroke);
    fill.setAttribute('stroke', color);
    fill.setAttribute('stroke-dasharray', c);
    fill.setAttribute('stroke-dashoffset', c); // arranca vacío para animar

    svg.appendChild(track);
    svg.appendChild(fill);
    wrap.appendChild(svg);

    var center = document.createElement('div');
    center.className = 'pe-ring__center';
    var num = document.createElement('span');
    num.className = 'pe-ring__num';
    num.style.fontSize = (size <= 90 ? '1.15rem' : '2rem');
    num.textContent = centerText;
    center.appendChild(num);
    if (subText) {
      var sub = document.createElement('small');
      sub.style.color = 'var(--pe-muted)';
      sub.style.fontSize = '0.7rem';
      sub.textContent = subText;
      center.appendChild(sub);
    }
    wrap.appendChild(center);

    // Animar en el siguiente frame.
    var target = (pct === null) ? c : c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { fill.style.strokeDashoffset = target; });
    });

    return wrap;
  }

  // ---------- Render ----------
  function show(id) { document.getElementById(id).style.display = ''; }
  function hide(id) { document.getElementById(id).style.display = 'none'; }

  function greetingByHour() {
    var h = new Date().getHours();
    if (h < 12) return 'Buenos días,';
    if (h < 19) return 'Buenas tardes,';
    return 'Buenas noches,';
  }

  function initials(name) {
    var parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderHero(student) {
    document.getElementById('pe-greeting').textContent = greetingByHour();
    document.getElementById('pe-name').textContent = student.name_student || 'Estudiante';
    document.getElementById('pe-avatar').textContent = initials(student.name_student);

    var chips = document.getElementById('pe-chips');
    chips.textContent = '';
    var data = [
      { icon: '🎓', text: 'Nivel ' + (student.level_group || '—') },
      { icon: '🏫', text: 'Sección ' + (student.section_group || '—') },
      { icon: '🕒', text: student.turno || 'Turno —' },
      { icon: '#', text: student.code_student || '' }
    ];
    data.forEach(function (d) {
      if (!d.text) return;
      var chip = document.createElement('span');
      chip.className = 'pe-chip';
      var ic = document.createElement('span');
      ic.textContent = d.icon;
      var tx = document.createElement('span');
      tx.textContent = d.text;
      chip.appendChild(ic);
      chip.appendChild(tx);
      chips.appendChild(chip);
    });
  }

  function renderOverview(perSubject) {
    var withData = perSubject.filter(function (s) { return s.value !== null; });
    var overall = avg(withData.map(function (s) { return s.value; }));
    var aprobadas = withData.filter(function (s) { return s.value >= 60; }).length;
    var riesgo = withData.filter(function (s) { return s.value < 60; }).length;

    var best = null;
    withData.forEach(function (s) { if (!best || s.value > best.value) best = s; });

    // Anillo del promedio general
    var ringHost = document.getElementById('pe-overall-ring');
    ringHost.textContent = '';
    var b = band(overall);
    ringHost.appendChild(makeRing(overall, fmt(overall), 'de 100', b.color, 132, 12));

    var status = document.getElementById('pe-overall-status');
    status.textContent = b.label;
    status.style.color = b.color;

    // Tarjetas de estadística
    var stats = document.getElementById('pe-stats');
    stats.textContent = '';
    var cards = [
      { icon: '📘', value: String(perSubject.length), label: 'Asignaturas' },
      { icon: '✅', value: String(aprobadas), label: 'Aprobadas' },
      { icon: '⚠️', value: String(riesgo), label: 'En riesgo' },
      { icon: '⭐', value: best ? (best.etiqueta || fmt(best.value)) : '—', label: best ? ('Mejor: ' + best.name) : 'Mejor nota' }
    ];
    cards.forEach(function (c, i) {
      var el = document.createElement('div');
      el.className = 'pe-card pe-stat';
      el.style.animationDelay = (0.05 * i) + 's';
      var icon = document.createElement('div');
      icon.className = 'pe-stat__icon';
      icon.textContent = c.icon;
      var val = document.createElement('div');
      val.className = 'pe-stat__value';
      val.textContent = c.value;
      var lab = document.createElement('div');
      lab.className = 'pe-stat__label';
      lab.textContent = c.label;
      el.appendChild(icon);
      el.appendChild(val);
      el.appendChild(lab);
      stats.appendChild(el);
    });
  }

  function renderSubjects(perSubject) {
    var host = document.getElementById('pe-subjects');
    host.textContent = '';

    if (!perSubject.length) {
      var empty = document.createElement('div');
      empty.className = 'pe-card pe-message';
      empty.style.gridColumn = '1 / -1';
      empty.innerHTML = '';
      var e1 = document.createElement('div'); e1.className = 'pe-message__emoji'; e1.textContent = '🌱';
      var e2 = document.createElement('div'); e2.className = 'pe-message__title'; e2.textContent = 'Aún no hay calificaciones';
      var e3 = document.createElement('div'); e3.className = 'pe-message__text';
      e3.textContent = 'Cuando tus docentes registren notas, aparecerán aquí.';
      empty.appendChild(e1); empty.appendChild(e2); empty.appendChild(e3);
      host.appendChild(empty);
      return;
    }

    perSubject.forEach(function (s, i) {
      var b = band(s.value);
      var card = document.createElement('div');
      card.className = 'pe-card pe-subject';
      card.style.animationDelay = (0.04 * i) + 's';
      card.style.color = s.value === null ? '#9a94ad' : b.color;

      card.appendChild(makeRing(s.value, s.etiqueta || fmt(s.value), '', b.color, 74, 7));

      var body = document.createElement('div');
      body.className = 'pe-subject__body';

      var name = document.createElement('div');
      name.className = 'pe-subject__name';
      name.title = s.name;
      name.textContent = s.name;
      name.style.color = 'var(--pe-ink)';

      var badge = document.createElement('span');
      badge.className = 'pe-badge';
      badge.style.background = b.color;
      badge.textContent = b.label;

      var dots = document.createElement('div');
      dots.className = 'pe-dots';
      var titles = ['I Parcial', 'II Parcial', 'III Parcial', 'IV Parcial'];
      s.partials.forEach(function (p, idx) {
        var dot = document.createElement('span');
        dot.className = 'pe-dot' + (p !== null ? ' pe-dot--on' : '');
        dot.title = titles[idx] + (p !== null ? (': ' + fmt(p)) : ': sin nota');
        dots.appendChild(dot);
      });

      body.appendChild(name);
      body.appendChild(badge);
      body.appendChild(dots);
      card.appendChild(body);
      host.appendChild(card);
    });
  }

  function renderMessage(emoji, title, text) {
    hide('pe-loading');
    hide('pe-content');
    var box = document.getElementById('pe-message');
    box.textContent = '';
    var e1 = document.createElement('div'); e1.className = 'pe-message__emoji'; e1.textContent = emoji;
    var e2 = document.createElement('div'); e2.className = 'pe-message__title'; e2.textContent = title;
    var e3 = document.createElement('div'); e3.className = 'pe-message__text'; e3.textContent = text;
    box.appendChild(e1); box.appendChild(e2); box.appendChild(e3);
    box.style.display = '';
  }

  function renderBulletin(record) {
    var student = record.student || {};
    var grades = record.grades || [];
    renderHero(student);

    var perSubject = grades.map(function (g) {
      // `value` es el numero (para promediar y colorear); `etiqueta` es lo
      // que ve el estudiante. En una asignatura cualitativa tiene que leer
      // "AA", no el 95 con que se calcula por dentro: eso es lo que dice su
      // boletin y lo que le van a preguntar en la casa.
      var actual = subjectCurrent(g);
      var cruda = campo(g, 'final_grade') || campo(g, 'second_semester') ||
                  campo(g, 'first_semester') || campo(g, 'quarter_partial') ||
                  campo(g, 'third_partial') || campo(g, 'second_partial') ||
                  campo(g, 'first_partial');
      return {
        name: g.name_subject || g.code_subject || 'Asignatura',
        value: actual,
        etiqueta: esCualitativa(cruda) ? String(cruda).trim().toUpperCase()
                                       : fmt(actual),
        partials: partialsOf(g)
      };
    });

    hide('pe-loading');
    hide('pe-message');
    show('pe-content');
    renderOverview(perSubject);
    renderSubjects(perSubject);
  }

  // Hook para validación local (inyectar datos de ejemplo sin backend).
  window.__peRenderBulletin = renderBulletin;

  // ---------- Carga ----------
  function load() {
    if (localStorage.getItem('user_role') !== 'ESTUDIANTE') return; // global.js ya redirige

    var code = localStorage.getItem('student_code') || '';
    var url = '/apiNote/Note/GetStudentBulletin/' +
      (code ? ('?code_student=' + encodeURIComponent(code)) : '');

    apiFetch(url)
      .then(function (res) {
        if (res.status === 402) {
          renderMessage('🔒', 'Boletín bloqueado',
            'Tu boletín está bloqueado por mensualidades pendientes. Por favor ponte al día en el departamento de administración.');
          return null;
        }
        if (res.status === 404) {
          renderMessage('📋', 'Sin matrícula activa',
            'No apareces matriculado en ningún grupo todavía. Consulta con la administración del centro.');
          return null;
        }
        if (!res.ok) {
          renderMessage('😕', 'No se pudo cargar',
            'Ocurrió un problema al cargar tu información. Intenta de nuevo más tarde.');
          return null;
        }
        return res.json();
      })
      .then(function (response) {
        if (!response) return;
        var record = response.Record || response;
        renderBulletin(record);
      })
      .catch(function () {
        renderMessage('📡', 'Sin conexión',
          'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
