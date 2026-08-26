/**
 * scriptReingreso.js — Rematricular a un estudiante que ya es del centro.
 *
 * POR QUE ESTA PANTALLA EXISTE APARTE DE MATRICULA
 * Son dos tramites distintos:
 *
 *   Matricula   la familia viene de fuera. No hay ficha ni tutor: hay que
 *               capturarlo todo y adjuntar los documentos de ingreso.
 *   Reingreso   el estudiante ya es del colegio. Su ficha, su tutor y sus
 *               documentos YA estan en el sistema.
 *
 * Aqui NO se piden datos personales a proposito. Volver a escribirlos es
 * justo donde se cuelan los duplicados y las erratas: asi fue como quedaron
 * dos fichas de un mismo estudiante que despues hubo que fusionar a mano.
 * Lo unico que se decide es el grupo del nuevo ciclo.
 */
(function () {
  'use strict';

  var seleccionado = null;   // el estudiante elegido de la busqueda
  var grupos = [];           // catalogo de grupos, para el selector

  function el(tag, clase, texto) {
    var nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  function vacio(host, mensaje) {
    host.textContent = '';
    var caja = el('div', 'empty');
    caja.appendChild(el('span', 'empty__icon', '🔍'));
    caja.appendChild(document.createTextNode(mensaje));
    host.appendChild(caja);
  }

  // ---------------- Busqueda ----------------
  // Se espera a que deje de escribir: sin esto cada tecla dispara una consulta
  // y las respuestas llegan desordenadas, pintando resultados de un texto que
  // ya no esta en la caja.
  var temporizador = null;
  function alEscribir() {
    clearTimeout(temporizador);
    temporizador = setTimeout(buscar, 350);
  }

  function buscar() {
    var termino = document.getElementById('q').value.trim();
    var host = document.getElementById('resultados');

    if (termino.length < 3) {
      vacio(host, 'Escriba al menos 3 caracteres.');
      return;
    }

    var ciclo = document.getElementById('ciclo_destino').value;
    var url = '/apiRegistration/Registration/BuscarParaReingreso/?q=' +
      encodeURIComponent(termino) + '&anio_lectivo=' + encodeURIComponent(ciclo);

    apiFetch(url)
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Error al buscar'); });
        return r.json();
      })
      .then(pintarResultados)
      .catch(function (err) { vacio(host, err.message); });
  }

  function pintarResultados(datos) {
    var host = document.getElementById('resultados');
    var filas = datos.resultados || [];

    if (!filas.length) {
      vacio(host, 'Nadie con matrícula previa calza con esa búsqueda. ' +
                  'Si viene de fuera del centro, use Matrícula.');
      return;
    }

    host.textContent = '';
    var envoltura = el('div', 'tbl-wrap');
    var tabla = el('table', 'tbl');
    var thead = el('thead');
    var filaCab = el('tr');
    ['Código', 'Estudiante', 'Último grupo', 'Tutor', 'Estado ' + datos.ciclo, '']
      .forEach(function (t) { filaCab.appendChild(el('th', null, t)); });
    thead.appendChild(filaCab);
    tabla.appendChild(thead);

    var tbody = el('tbody');
    filas.forEach(function (f) {
      var tr = el('tr');
      tr.appendChild(el('td', null, f.code_student));
      tr.appendChild(el('td', null, f.nombre));
      tr.appendChild(el('td', null,
        (f.ultimo_grupo || '—') + (f.ultimo_ciclo ? ' (' + f.ultimo_ciclo + ')' : '')));
      tr.appendChild(el('td', null, f.tutor || 'Sin tutor'));

      var tdEstado = el('td');
      if (f.ya_matriculado) {
        tdEstado.appendChild(el('span', 'pill pill--ya', 'Ya matriculado'));
      } else {
        tdEstado.appendChild(el('span', 'pill pill--ok', 'Puede reingresar'));
      }
      tr.appendChild(tdEstado);

      var tdBoton = el('td');
      var boton = el('button', 'dash__refresh', 'Seleccionar');
      boton.type = 'button';
      if (f.ya_matriculado) {
        // No se ofrece el boton: crear una segunda matricula viva del mismo
        // ciclo pone al estudiante en dos listas de asistencia y en dos actas.
        boton.disabled = true;
        boton.textContent = f.estado_actual === 'PENDIENTE' ? 'Pendiente' : 'Confirmada';
        boton.title = 'Ya tiene matrícula de ' + datos.ciclo;
      } else {
        boton.addEventListener('click', function () { elegir(f, datos.ciclo); });
      }
      tdBoton.appendChild(boton);
      tr.appendChild(tdBoton);

      tbody.appendChild(tr);
    });

    tabla.appendChild(tbody);
    envoltura.appendChild(tabla);
    host.appendChild(envoltura);
  }

  // ---------------- Ficha ----------------
  function dato(host, etiqueta, valor) {
    var caja = el('div');
    caja.appendChild(el('div', 'dato__label', etiqueta));
    caja.appendChild(el('div', 'dato__valor', valor || '—'));
    host.appendChild(caja);
  }

  function elegir(fila, ciclo) {
    seleccionado = fila;
    seleccionado.ciclo = ciclo;

    var host = document.getElementById('ficha_datos');
    host.textContent = '';
    dato(host, 'Código', fila.code_student);
    dato(host, 'Estudiante', fila.nombre);
    dato(host, 'Fecha de nacimiento', fila.birthday_student);
    dato(host, 'Teléfono', fila.phone_student);
    dato(host, 'Tutor responsable', fila.tutor);
    dato(host, 'Teléfono del tutor', fila.tutor_telefono);
    dato(host, 'Cursó en', (fila.ultimo_grupo || '—') +
         (fila.ultimo_ciclo ? ' (' + fila.ultimo_ciclo + ')' : ''));
    dato(host, 'Turno anterior', fila.turno);

    if (!fila.id_tutor) {
      showToast('Este estudiante no tiene tutor en su matrícula anterior. ' +
                'Asígnele uno antes de matricular.', 'warning');
    }

    document.getElementById('ficha').classList.add('activa');
    document.getElementById('ficha').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelar() {
    seleccionado = null;
    document.getElementById('ficha').classList.remove('activa');
  }

  // ---------------- Grupos ----------------
  function cargarGrupos() {
    // La lista completa de grupos, no la de cupos disponibles: quien decide
    // quien entra es el Director al confirmar, y un grupo puede verse lleno
    // por reingresos pendientes que quiza no se confirmen.
    apiFetch('/apiGroup/Group/ListaGrupos/')
      .then(function (r) {
        if (!r.ok) throw new Error('No se pudieron cargar los grupos');
        return r.json();
      })
      .then(function (lista) {
        grupos = lista;
        var niveles = [];
        lista.forEach(function (g) {
          if (niveles.indexOf(g.level_group) === -1) niveles.push(g.level_group);
        });
        var selNivel = document.getElementById('nivel_destino');
        niveles.forEach(function (n) {
          var op = el('option', null, n);
          op.value = n;
          selNivel.appendChild(op);
        });
      })
      .catch(function (err) { showToast(err.message, 'error'); });
  }

  function filtrarGrupos() {
    var nivel = document.getElementById('nivel_destino').value;
    var sel = document.getElementById('grupo_destino');
    sel.textContent = '';
    var placeholder = el('option', null, 'Seleccione un grupo');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    sel.appendChild(placeholder);

    grupos.filter(function (g) { return !nivel || g.level_group === nivel; })
      .forEach(function (g) {
        var op = el('option', null,
          g.code_group + ' - ' + g.level_group + ' (' + g.section_group + ')');
        op.value = g.id;
        sel.appendChild(op);
      });
  }

  // ---------------- Guardar ----------------
  function guardar() {
    if (!seleccionado) {
      showToast('Primero seleccione un estudiante', 'warning');
      return;
    }
    var idGrupo = document.getElementById('grupo_destino').value;
    if (!idGrupo) {
      showToast('Elija el grupo del nuevo ciclo', 'warning');
      return;
    }

    var boton = document.getElementById('btn_guardar');
    boton.disabled = true;

    var cuerpo = new FormData();
    cuerpo.append('id_student', seleccionado.id_student);
    cuerpo.append('id_group', idGrupo);
    cuerpo.append('anio_lectivo', document.getElementById('ciclo_destino').value);
    var turno = document.getElementById('turno_destino').value;
    if (turno) cuerpo.append('mode_registration', turno);

    apiFetch('/apiRegistration/Registration/PostReingreso/', {
      method: 'POST', body: cuerpo
    })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || 'No se pudo registrar el reingreso');
          return d;
        });
      })
      .then(function (d) {
        showToast(d.message, 'success');
        cancelar();
        buscar();   // refresca la lista: ahora sale como "Ya matriculado"
      })
      .catch(function (err) { showToast(err.message, 'error'); })
      .finally(function () { boton.disabled = false; });
  }

  // ---------------- Arranque ----------------
  window.addEventListener('DOMContentLoaded', function () {
    // Las ventanas de matricula se abren durante un ciclo para llenar el
    // SIGUIENTE, asi que ese es el valor util por defecto.
    document.getElementById('ciclo_destino').value = new Date().getFullYear() + 1;

    document.getElementById('q').addEventListener('input', alEscribir);
    document.getElementById('ciclo_destino').addEventListener('change', buscar);
    document.getElementById('nivel_destino').addEventListener('change', filtrarGrupos);
    document.getElementById('btn_guardar').addEventListener('click', guardar);
    document.getElementById('btn_cancelar').addEventListener('click', cancelar);

    vacio(document.getElementById('resultados'),
          'Escriba el nombre o el código del estudiante.');
    cargarGrupos();
  });
})();
