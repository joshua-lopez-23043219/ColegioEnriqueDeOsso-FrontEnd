/**
 * scriptMaestro.js — Teacher registration logic with API integration
 *
 * Áreas/asignaturas: un docente puede impartir más de una (Marta Herrera da
 * Química y Biología; Fanni Casco, Matemática y Aprender-Emprender-Prosperar).
 * El formulario permite agregar varias filas y se guardan en `area_teacher`
 * separadas por coma. Se mantiene ese mismo campo —y no una tabla nueva—
 * porque `area_teacher` es la ESPECIALIDAD del docente, texto libre que el
 * colegio ya escribe así ("Química y Biología"); las asignaturas concretas
 * que imparte a cada grupo viven en el horario (Imparte), que es donde
 * realmente se asignan clase por clase.
 */

const AREAS_DISPONIBLES = [
  'Lengua y Literatura',
  'Lengua Extranjera (Inglés)',
  'Talleres de Arte y Cultura',
  'Creciendo en Valores',
  'Educación Física Y Práctica Deportiva',
  'Educación para Aprender, Emprender, Prosperar',
  'Ciencias Sociales (Geografía)',
  'Ciencias Sociales (Geografía/Historia)',
  'Ciencias Sociales (Geografía/Economía)',
  'Ciencias Sociales (Geografía/Filosofía)',
  'Ciencias Naturales',
  'Química',
  'Física',
  'Biología',
  'Matemática',
  'TI',
];

// Crea una fila de área. La primera lleva el id "asignatura" para no romper
// el `for` de la etiqueta ni la validación del formulario.
function crearFilaArea(valor = '') {
  const contenedor = document.getElementById('areas-container');
  const fila = document.createElement('div');
  fila.className = 'area-fila';

  const select = document.createElement('select');
  select.className = 'form__control area-select';
  if (!contenedor.querySelector('.area-select')) {
    select.id = 'asignatura';
    select.required = true;
  }

  const vacia = document.createElement('option');
  vacia.value = '';
  vacia.textContent = 'Seleccione una opción';
  vacia.disabled = true;
  select.appendChild(vacia);

  // Si el docente trae un área que no está en la lista (datos viejos o
  // escritos a mano), se agrega como opción para no perderla al editar.
  const opciones = AREAS_DISPONIBLES.includes(valor) || !valor
    ? AREAS_DISPONIBLES
    : [...AREAS_DISPONIBLES, valor];

  opciones.forEach(area => {
    const opt = document.createElement('option');
    opt.value = area;
    opt.textContent = area;
    select.appendChild(opt);
  });

  select.value = valor || '';
  if (!valor) vacia.selected = true;

  const quitar = document.createElement('button');
  quitar.type = 'button';
  quitar.className = 'btn-quitar-area';
  quitar.title = 'Quitar esta materia';
  quitar.textContent = '×';
  quitar.addEventListener('click', () => {
    fila.remove();
    if (!contenedor.querySelector('.area-fila')) crearFilaArea();
    sincronizarBotonesQuitar();
  });

  fila.appendChild(select);
  fila.appendChild(quitar);
  contenedor.appendChild(fila);
  sincronizarBotonesQuitar();
  return select;
}

// Con una sola fila no tiene sentido poder quitarla.
function sincronizarBotonesQuitar() {
  const filas = document.querySelectorAll('#areas-container .area-fila');
  filas.forEach(fila => {
    const boton = fila.querySelector('.btn-quitar-area');
    if (boton) boton.disabled = filas.length === 1;
  });
}

// Áreas elegidas, sin vacíos ni repetidas, listas para enviar.
function areasSeleccionadas() {
  const valores = Array.from(document.querySelectorAll('#areas-container .area-select'))
    .map(s => s.value.trim())
    .filter(Boolean);
  return Array.from(new Set(valores));
}

// Rellena las filas a partir de lo guardado ("Química, Biología").
function cargarAreas(areaTexto) {
  const contenedor = document.getElementById('areas-container');
  contenedor.innerHTML = '';
  const areas = String(areaTexto || '')
    .split(',')
    .map(a => a.trim())
    .filter(Boolean);
  if (areas.length === 0) {
    crearFilaArea();
    return;
  }
  areas.forEach(area => crearFilaArea(area));
}

document.addEventListener('DOMContentLoaded', function () {
  cargarAreas('');
  const botonAgregar = document.getElementById('btn-add-area');
  if (botonAgregar) {
    botonAgregar.addEventListener('click', () => crearFilaArea());
  }
});

// Buscar maestro por cédula (Enter key)
document.getElementById("Nmaestro").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const code = this.value.trim();

    if (!code) {
      showToast("Ingrese el número de cédula para buscar", "warning");
      return;
    }

    apiFetch(`/apiTeacher/Teacher/SpecificTeacher/?code_teacher=${encodeURIComponent(code)}`)
      .then(response => {
        if (!response.ok) throw new Error("Maestro no encontrado");
        return response.json();
      })
      .then(dataTR => {
        document.getElementById('Nmaestro').value = dataTR.code_teacher;
        
        // Separar el nombre en nombres y apellidos para los dos campos de la interfaz
        const names = dataTR.name_teacher.split(' ');
        let nombresVal = '';
        let apellidosVal = '';
        if (names.length > 1) {
          const mid = Math.ceil(names.length / 2);
          nombresVal = names.slice(0, mid).join(' ');
          apellidosVal = names.slice(mid).join(' ');
        } else {
          nombresVal = dataTR.name_teacher;
        }

        document.getElementById('nombres').value = nombresVal;
        document.getElementById('apellidos').value = apellidosVal;
        document.getElementById('direccion').value = dataTR.address_teacher;
        document.getElementById('telefono').value = dataTR.phone_teacher;
        document.getElementById('email').value = dataTR.email_teacher;
        
        // Rellenar las filas de area/asignatura del docente
        cargarAreas(dataTR.area_teacher);

        document.getElementById("id_teacher").value = dataTR.id;
        showToast("Maestro encontrado correctamente", "success");
      })
      .catch(error => {
        showToast("Error al buscar maestro: " + error.message, "error");
        document.getElementById("nombres").value = '';
        document.getElementById("apellidos").value = '';
        document.getElementById("direccion").value = '';
        document.getElementById("telefono").value = '';
        document.getElementById("email").value = '';
        cargarAreas('');
        document.getElementById("id_teacher").value = '';
      });
  }
});

// Guardar nuevo maestro
function guardarmaestro(event) {
  event.preventDefault();
  const Nmaestro = document.getElementById("Nmaestro").value.trim();
  const nombres = document.getElementById("nombres").value.trim();
  const apellidos = document.getElementById("apellidos").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const email = document.getElementById("email").value.trim();
  const areas = areasSeleccionadas();
  const asignatura = areas.join(", ");

  if (!Nmaestro || !nombres || !apellidos || !direccion || !telefono || !email || !asignatura) {
    showToast("Completa todos los Campos", "warning");
    return;
  }

  const payload = {
    code_teacher: Nmaestro,
    name_teacher: `${nombres} ${apellidos}`,
    phone_teacher: telefono,
    email_teacher: email,
    address_teacher: direccion,
    area_teacher: asignatura
  };

  apiFetch('/apiTeacher/Teacher/PostTeacher/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) throw new Error("Error al guardar maestro");
      return response.json();
    })
    .then(data => {
      showToast("Maestro guardado correctamente", "success");
      document.getElementById("form-validation").reset();
      cargarAreas('');
      document.getElementById("id_teacher").value = '';
    })
    .catch(error => {
      showToast("Error al registrar maestro: " + error.message, "error");
    });
}

// Editar maestro existente
function editarmaestro(event) {
  event.preventDefault();
  const idTeacher = document.getElementById("id_teacher").value;
  const Nmaestro = document.getElementById("Nmaestro").value.trim();
  const nombres = document.getElementById("nombres").value.trim();
  const apellidos = document.getElementById("apellidos").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const email = document.getElementById("email").value.trim();
  const areas = areasSeleccionadas();
  const asignatura = areas.join(", ");

  if (!idTeacher) {
    showToast("Por favor, busque un maestro primero para poder editarlo", "warning");
    return;
  }

  if (!Nmaestro || !nombres || !apellidos || !direccion || !telefono || !email || !asignatura) {
    showToast("Completa todos los Campos", "warning");
    return;
  }

  const payload = {
    id: idTeacher,
    code_teacher: Nmaestro,
    name_teacher: `${nombres} ${apellidos}`,
    phone_teacher: telefono,
    email_teacher: email,
    address_teacher: direccion,
    area_teacher: asignatura
  };

  apiFetch('/apiTeacher/Teacher/UpdateTeacher/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) throw new Error("Error al actualizar maestro");
      return response.json();
    })
    .then(data => {
      showToast("Maestro actualizado correctamente", "success");
      document.getElementById("form-validation").reset();
      cargarAreas('');
      document.getElementById("id_teacher").value = '';
    })
    .catch(error => {
      showToast("Error al actualizar maestro: " + error.message, "error");
    });
}

// Eliminar maestro
function eliminarmaestro(event) {
  event.preventDefault();
  const idTeacher = document.getElementById("id_teacher").value;

  if (!idTeacher) {
    showToast("Por favor, busque un maestro primero para poder eliminarlo", "warning");
    return;
  }

  if (!confirm("¿Está seguro de que desea eliminar a este maestro?")) {
    return;
  }

  const payload = {
    id: idTeacher
  };

  apiFetch('/apiTeacher/Teacher/DeleteTeacher/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) throw new Error("Error al eliminar maestro");
      return response.json();
    })
    .then(data => {
      showToast("Maestro eliminado correctamente", "success");
      document.getElementById("form-validation").reset();
      cargarAreas('');
      document.getElementById("id_teacher").value = '';
    })
    .catch(error => {
      showToast("Error al eliminar maestro: " + error.message, "error");
    });
}