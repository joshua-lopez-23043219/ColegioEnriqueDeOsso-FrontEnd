/**
 * scriptMaestro.js — Teacher registration logic with API integration
 *
 * Asignaturas: un docente puede impartir más de una (Marta Herrera da Química
 * y Biología; Fanni Casco, Matemática y Aprender-Emprender-Prosperar). El
 * formulario permite agregar varias filas con "Agregar materia".
 *
 * Lo que se elige NO es una etiqueta de texto: se envía en `subject_names` y
 * el backend enlaza al docente con las asignaturas reales del sistema
 * (Teacher.subjects). Ese vínculo es el que usa Registro de Horario para
 * rechazar que se le asigne una clase de una materia que no imparte.
 *
 * `area_teacher` se sigue enviando con lo mismo, separado por coma, porque
 * varias pantallas lo muestran como especialidad legible y el generador
 * automático de horarios lo usa para repartir docentes por área.
 */

// Nombres de asignatura disponibles. Se cargan de la tabla real de materias
// (/apiSubjects) en vez de una lista fija, porque ahora la seleccion NO es
// una etiqueta de texto: enlaza al docente con las asignaturas del sistema y
// el horario usa ese vinculo para no asignarle una clase que no imparte.
//
// Se muestran los nombres UNICOS: cada asignatura existe una vez por grado
// ("Matematicas" tiene fila para 7mo, otra para 8vo...), y al colegio le
// interesa decir "Marta Herrera da Quimica", no marcarla cinco veces. El
// backend enlaza todas las filas con ese nombre.
let AREAS_DISPONIBLES = [];

function cargarCatalogoMaterias() {
  return apiFetch('/apiSubjects/Subjects/')
    .then(res => {
      if (!res.ok) throw new Error('No se pudo cargar el catálogo de asignaturas');
      return res.json();
    })
    .then(datos => {
      const lista = Array.isArray(datos) ? datos : (datos.Record || []);
      AREAS_DISPONIBLES = Array.from(
        new Set(lista.map(s => (s.name_subject || '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'es'));
    })
    .catch(err => {
      console.error(err);
      showToast('No se pudo cargar el catálogo de asignaturas', 'error');
    });
}

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
  cargarCatalogoMaterias().then(() => cargarAreas(''));
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
        cargarAreas(
          Array.isArray(dataTR.subjects_detail) && dataTR.subjects_detail.length
            ? dataTR.subjects_detail.join(', ')
            : dataTR.area_teacher
        );

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
    // area_teacher se conserva como especialidad legible; subject_names es
    // el vinculo real con las asignaturas del sistema.
    area_teacher: asignatura,
    subject_names: areas
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
    // area_teacher se conserva como especialidad legible; subject_names es
    // el vinculo real con las asignaturas del sistema.
    area_teacher: asignatura,
    subject_names: areas
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