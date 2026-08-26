/**
 * scriptCompletarDatos.js — El estudiante completa su propia ficha.
 *
 * POR QUE EXISTE
 * Casi todas las fichas entraron por carga masiva desde los libros de notas:
 * solo traen nombre y grupo. `datosIncompletos.html` ya le muestra a
 * administracion a quien le falta que, pero alguien tiene que ir persiguiendo
 * a 500 familias. Quien mejor conoce esos datos es el propio estudiante.
 *
 * QUE PUEDE EDITAR
 * Solo los campos de su ficha personal. El servidor ignora cualquier otra
 * cosa que llegue en el envio --grupo, solvencia, codigo, nombre-- porque eso
 * decide en que lista sale, que notas ve y si esta al dia con el colegio.
 * La pantalla ni siquiera los dibuja, pero la regla vive en el servidor: el
 * formulario es una comodidad, no la seguridad.
 *
 * SOLO APARECE SI FALTA ALGO
 * Si la ficha esta completa el apartado no se muestra. Un formulario que
 * siempre esta ahi pidiendo datos se vuelve invisible.
 */
(function () {
  'use strict';

  // Como se dibuja cada campo. La etiqueta y el orden los manda el servidor;
  // esto solo dice que control usar para escribirlo.
  var CONTROLES = {
    gender: { tipo: 'select', opciones: [['F', 'Femenino'], ['M', 'Masculino']] },
    birthday_student: { tipo: 'date' },
    email_student: { tipo: 'email' },
    phone_student: { tipo: 'tel' },
    address: { tipo: 'text', ancho: 2 },
    health_condition: { tipo: 'text', ancho: 2, ayuda: 'Alergias, condiciones. Escriba NINGUNO si no aplica.' },
    weight: { tipo: 'text', ayuda: 'En libras' },
    height: { tipo: 'text', ayuda: 'En metros, ej. 1.62' }
  };

  var seccion, campos, intro, estado;

  function el(tag, clase, texto) {
    var nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  function dibujarCampo(faltante, valorActual) {
    var conf = CONTROLES[faltante.campo] || { tipo: 'text' };
    var caja = el('div');
    if (conf.ancho === 2) caja.style.gridColumn = 'span 2';

    var etiqueta = el('label', null, faltante.etiqueta);
    etiqueta.style.cssText =
      'display:block; font-size:0.75rem; font-weight:700; text-transform:uppercase;' +
      'letter-spacing:0.4px; color:var(--slate-500); margin-bottom:5px;';
    etiqueta.setAttribute('for', 'dato_' + faltante.campo);
    caja.appendChild(etiqueta);

    var control;
    if (conf.tipo === 'select') {
      control = el('select');
      var vacia = el('option', null, 'Seleccione');
      vacia.value = '';
      control.appendChild(vacia);
      conf.opciones.forEach(function (par) {
        var op = el('option', null, par[1]);
        op.value = par[0];
        control.appendChild(op);
      });
    } else {
      control = el('input');
      control.type = conf.tipo;
    }
    control.id = 'dato_' + faltante.campo;
    control.setAttribute('data-campo', faltante.campo);
    control.value = valorActual || '';
    control.style.cssText =
      'width:100%; padding:9px 11px; border:1px solid var(--slate-300,#cbd5e1);' +
      'border-radius:8px; font-size:0.9rem; font-family:inherit; box-sizing:border-box;';
    caja.appendChild(control);

    // Lo crítico dice qué se rompe si falta: es lo que hace que alguien lo
    // llene en vez de saltárselo.
    var nota = faltante.consecuencia || conf.ayuda;
    if (nota) {
      var ayuda = el('small', null, nota);
      ayuda.style.cssText = 'display:block; margin-top:4px; font-size:0.76rem; color:var(--slate-500);';
      caja.appendChild(ayuda);
    }
    if (faltante.criticidad === 'critico') {
      etiqueta.appendChild(el('span', null, ' *')).style.color = 'var(--danger,#c0392b)';
    }
    return caja;
  }

  function pintar(datos) {
    if (datos.completa) {
      seccion.style.display = 'none';
      return;
    }

    var criticos = datos.faltantes.filter(function (f) { return f.criticidad === 'critico'; });
    intro.textContent = criticos.length
      ? 'Faltan ' + datos.faltantes.length + ' dato(s) en tu ficha, ' +
        criticos.length + ' de ellos importantes para tu boletín. Completalos aquí.'
      : 'Faltan ' + datos.faltantes.length + ' dato(s) para completar tu ficha.';

    campos.textContent = '';
    datos.faltantes.forEach(function (f) {
      campos.appendChild(dibujarCampo(f, (datos.valores || {})[f.campo]));
    });
    seccion.style.display = 'block';
  }

  function cargar() {
    apiFetch('/apiStudent/Student/MisDatosPendientes/')
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'No se pudo consultar tu ficha'); });
        return r.json();
      })
      .then(pintar)
      .catch(function (err) {
        // Sin ficha asociada no se molesta al estudiante con un error: el
        // portal sigue funcionando y esto simplemente no aparece.
        console.warn('Completar datos:', err.message);
        seccion.style.display = 'none';
      });
  }

  function guardar() {
    var boton = document.getElementById('pe-datos-guardar');
    var cuerpo = new FormData();
    var enviados = 0;

    campos.querySelectorAll('[data-campo]').forEach(function (control) {
      var valor = (control.value || '').trim();
      if (valor) {
        cuerpo.append(control.getAttribute('data-campo'), valor);
        enviados++;
      }
    });

    if (!enviados) {
      showToast('Llene al menos un dato antes de guardar', 'warning');
      return;
    }

    boton.disabled = true;
    estado.textContent = 'Guardando…';

    apiFetch('/apiStudent/Student/CompletarMisDatos/', { method: 'POST', body: cuerpo })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || 'No se pudieron guardar los datos');
          return d;
        });
      })
      .then(function (d) {
        showToast(d.message, 'success');
        if (d.completa) {
          estado.textContent = '';
          seccion.style.display = 'none';
          showToast('🎉 Tu ficha quedó completa', 'success');
        } else {
          estado.textContent = 'Faltan ' + d.faltantes.length + ' dato(s).';
          cargar();   // vuelve a dibujar solo lo que sigue faltando
        }
      })
      .catch(function (err) {
        estado.textContent = '';
        showToast(err.message, 'error');
      })
      .finally(function () { boton.disabled = false; });
  }

  window.addEventListener('DOMContentLoaded', function () {
    seccion = document.getElementById('pe-datos');
    campos = document.getElementById('pe-datos-campos');
    intro = document.getElementById('pe-datos-intro');
    estado = document.getElementById('pe-datos-estado');
    if (!seccion) return;

    document.getElementById('pe-datos-guardar').addEventListener('click', guardar);
    cargar();
  });
})();
